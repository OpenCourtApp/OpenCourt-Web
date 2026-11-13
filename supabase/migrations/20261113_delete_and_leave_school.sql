-- School lifecycle: hard delete by the principal and self-leave by members.
-- Forward-only migration (no down).

CREATE OR REPLACE FUNCTION public.delete_school(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_active_school uuid;
  v_member        uuid;
  v_next          uuid;
  v_next_role     user_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_active_school := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;
  IF p_school_id IS DISTINCT FROM v_active_school THEN
    RAISE EXCEPTION 'not_active_school';
  END IF;

  -- Re-home members whose active school is the one being deleted.
  FOR v_member IN
    SELECT m.user_id
    FROM   memberships m
    JOIN   users u ON u.id = m.user_id
    WHERE  m.school_id = p_school_id
      AND  u.active_school_id = p_school_id
  LOOP
    SELECT school_id, role INTO v_next, v_next_role
    FROM   memberships
    WHERE  user_id = v_member AND school_id <> p_school_id
    ORDER  BY created_at
    LIMIT  1;

    IF FOUND THEN
      UPDATE users SET active_school_id = v_next WHERE id = v_member;
      UPDATE auth.users
      SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
        'active_school_id', v_next::text,
        'role',             v_next_role::text
      )
      WHERE id = v_member;
    ELSE
      UPDATE users SET active_school_id = NULL WHERE id = v_member;
      UPDATE auth.users
      SET raw_user_meta_data = raw_user_meta_data - 'active_school_id' - 'role'
      WHERE id = v_member;
    END IF;
  END LOOP;

  -- memberships, invitations, courts and bookings cascade off this row.
  DELETE FROM schools WHERE id = p_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_school(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_school(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_school()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role      user_role;
  v_next      uuid;
  v_next_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'no_active_school'; END IF;

  SELECT role INTO v_role
  FROM   memberships
  WHERE  user_id = auth.uid() AND school_id = v_school_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_member'; END IF;
  IF v_role = 'principal' THEN RAISE EXCEPTION 'principal_cannot_leave'; END IF;

  DELETE FROM memberships WHERE user_id = auth.uid() AND school_id = v_school_id;

  SELECT school_id, role INTO v_next, v_next_role
  FROM   memberships
  WHERE  user_id = auth.uid()
  ORDER  BY created_at
  LIMIT  1;

  IF FOUND THEN
    UPDATE users SET active_school_id = v_next WHERE id = auth.uid();
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
      'active_school_id', v_next::text,
      'role',             v_next_role::text
    )
    WHERE id = auth.uid();
  ELSE
    UPDATE users SET active_school_id = NULL WHERE id = auth.uid();
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data - 'active_school_id' - 'role'
    WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_school() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.leave_school() TO authenticated;

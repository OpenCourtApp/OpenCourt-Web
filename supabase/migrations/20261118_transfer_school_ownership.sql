-- Transfer of school ownership (principal handover).
-- Forward-only migration (no down).
--
-- Rules enforced here:
--   * Only the current principal of the school may transfer it.
--   * Only the caller's active school can be transferred (same rule as
--     delete_school), so the caller's JWT metadata can be kept truthful.
--   * The new principal must already be a member of that school.
--   * The handover is atomic: the school never exists without a principal.
--
-- The outgoing principal stays in the school as a teacher. That keeps their
-- bookings/history intact and lets them leave afterwards through leave_school.

CREATE OR REPLACE FUNCTION public.transfer_school_ownership(
  p_school_id        uuid,
  p_new_principal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_active_school uuid;
  v_new_role      user_role;
  v_new_active    uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Serialize concurrent transfers for this school. Without this, two requests
  -- could both pass the "caller is principal" check and promote two different
  -- members.
  PERFORM id FROM memberships WHERE school_id = p_school_id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  user_id   = auth.uid()
      AND  school_id = p_school_id
      AND  role      = 'principal'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- The source of truth for the caller's context is public.users. The JWT copy
  -- can lag behind a switch performed in another tab.
  SELECT active_school_id INTO v_active_school
  FROM   users
  WHERE  id = auth.uid();

  IF p_school_id IS DISTINCT FROM v_active_school THEN
    RAISE EXCEPTION 'not_active_school';
  END IF;

  IF p_new_principal_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_transfer_to_self';
  END IF;

  SELECT role INTO v_new_role
  FROM   memberships
  WHERE  user_id   = p_new_principal_id
    AND  school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_member'; END IF;
  IF v_new_role = 'principal' THEN RAISE EXCEPTION 'already_principal'; END IF;

  UPDATE memberships
  SET    role = 'teacher'
  WHERE  user_id = auth.uid() AND school_id = p_school_id;

  UPDATE memberships
  SET    role = 'principal'
  WHERE  user_id = p_new_principal_id AND school_id = p_school_id;

  -- The caller's token still claims 'principal'; fix it right away so
  -- principal-only paths (delete_school, UI menus) stop trusting it.
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', 'teacher'
  )
  WHERE id = auth.uid();

  -- The new principal only needs the role in their metadata if this school is
  -- their active context. Otherwise switch_school fills it in later.
  SELECT active_school_id INTO v_new_active FROM users WHERE id = p_new_principal_id;
  IF v_new_active = p_school_id THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'role', 'principal'
    )
    WHERE id = p_new_principal_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_school_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.transfer_school_ownership(uuid, uuid) TO authenticated;

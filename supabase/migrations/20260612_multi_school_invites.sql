-- ============================================================
-- OpenCourt – Multi-school + Email Invites
-- Migrates from single-school token model to invite-only
-- multi-school memberships.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. New enum
-- ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────
-- 2. Add active_school_id to users (nullable for migration safety)
-- ──────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_school_id uuid
  REFERENCES schools(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────
-- 3. memberships table  (user ↔ school join with role)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_user_school
  ON memberships (user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id
  ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_school_id
  ON memberships (school_id);

-- ──────────────────────────────────────────────────────────
-- 4. invitations table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        user_role NOT NULL,
  invited_by  uuid REFERENCES users(id),
  status      invitation_status NOT NULL DEFAULT 'pending',
  expires_at  timestamptz DEFAULT now() + interval '7 days',
  created_at  timestamptz DEFAULT now()
);

-- Only one pending invite per email+school at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_school_email
  ON invitations (school_id, email) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_school_id
  ON invitations (school_id);

-- ──────────────────────────────────────────────────────────
-- 5. Data migration: copy existing relationships
-- ──────────────────────────────────────────────────────────

-- Copy each user's current school + role into memberships
INSERT INTO memberships (user_id, school_id, role)
SELECT id, school_id, role
FROM   users
WHERE  school_id IS NOT NULL
ON CONFLICT (user_id, school_id) DO NOTHING;

-- Their existing school becomes the active one
UPDATE users
SET    active_school_id = school_id
WHERE  school_id IS NOT NULL
  AND  active_school_id IS NULL;

-- Mirror active_school_id into JWT metadata (remove old school_id key)
UPDATE auth.users
SET raw_user_meta_data =
  (raw_user_meta_data - 'school_id')
  || jsonb_build_object(
       'active_school_id', raw_user_meta_data ->> 'school_id'
     )
WHERE raw_user_meta_data ? 'school_id';

-- ──────────────────────────────────────────────────────────
-- 6. Enable RLS on new tables
-- ──────────────────────────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- 7. Drop old policies that reference columns being removed
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can look up schools by access token"  ON schools;
DROP POLICY IF EXISTS "Users can view their own school"             ON schools;
DROP POLICY IF EXISTS "Users can view users in their school"        ON users;
DROP POLICY IF EXISTS "Principals can insert users in their school" ON users;
DROP POLICY IF EXISTS "Principals can delete users in their school" ON users;
-- "Users can update their own profile" is safe to keep — no column refs

-- ──────────────────────────────────────────────────────────
-- 8. New RLS policies
-- ──────────────────────────────────────────────────────────

-- schools: visible only to members
CREATE POLICY "Members can view their schools"
  ON schools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE  m.school_id = schools.id
        AND  m.user_id   = auth.uid()
    )
  );

-- memberships: claims-only selects (never joins users → avoids recursion)
CREATE POLICY "View active school members"
  ON memberships FOR SELECT
  USING (
    school_id = COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

CREATE POLICY "View own memberships"
  ON memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Principal can add members"
  ON memberships FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
    AND school_id = COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

CREATE POLICY "Principal can remove members"
  ON memberships FOR DELETE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
    AND school_id = COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

-- users: own profile + anyone in same active school
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view same active school"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE  m.user_id   = users.id
        AND  m.school_id = COALESCE(
          (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid
        )
    )
  );

-- invitations: principal of active school manages; invitees read their own
CREATE POLICY "Principal can manage invitations"
  ON invitations FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
    AND school_id = COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
    AND school_id = COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

-- auth.email() is SECURITY DEFINER; a direct SELECT on auth.users here
-- would run as `authenticated`, which has no privilege on that table.
CREATE POLICY "Invitees can view their own invitations"
  ON invitations FOR SELECT
  USING (
    lower(trim(email)) = lower(trim(COALESCE(auth.email(), '')))
  );

-- ──────────────────────────────────────────────────────────
-- 9. Updated handle_new_user trigger (simplified — no school_id/role)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  -- inviteUserByEmail also fires this trigger; ON CONFLICT prevents duplicates.
  INSERT INTO public.users (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 10. Drop complete_onboarding (superseded by accept_invitation)
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, text);
DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, public.user_role);

-- ──────────────────────────────────────────────────────────
-- 11. Updated create_school RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_school(
  p_school_name text,
  p_full_name   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_token     text;
  v_chars     text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_attempt   int  := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Unique OC-XXXX-XXXX token (unambiguous alphabet, collision-safe)
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'token_generation_failed';
    END IF;

    SELECT string_agg(
      substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1),
      '' ORDER BY n
    )
    INTO v_token
    FROM generate_series(1, 8) AS n;

    v_token := 'OC-' || substr(v_token, 1, 4) || '-' || substr(v_token, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM schools WHERE access_token = v_token);
  END LOOP;

  INSERT INTO schools (name, access_token)
  VALUES (p_school_name, v_token)
  RETURNING id INTO v_school_id;

  INSERT INTO memberships (user_id, school_id, role)
  VALUES (auth.uid(), v_school_id, 'principal');

  UPDATE users
  SET active_school_id = v_school_id,
      full_name = CASE WHEN p_full_name <> '' THEN p_full_name ELSE full_name END
  WHERE id = auth.uid();

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'active_school_id', v_school_id::text,
    'role',             'principal',
    'full_name',        p_full_name
  )
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.create_school(text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_school(text, text) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 12. accept_invitation RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_inv  invitations%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv
  FROM   invitations
  WHERE  lower(trim(email)) = lower(trim(v_email))
    AND  status     = 'pending'
    AND  expires_at > now()
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_invitation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE  user_id   = auth.uid()
      AND  school_id = v_inv.school_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO memberships (user_id, school_id, role)
  VALUES (auth.uid(), v_inv.school_id, v_inv.role);

  UPDATE users
  SET active_school_id = v_inv.school_id,
      full_name = CASE WHEN p_full_name <> '' THEN p_full_name ELSE full_name END
  WHERE id = auth.uid();

  UPDATE invitations
  SET status = 'accepted'
  WHERE id = v_inv.id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'active_school_id', v_inv.school_id::text,
    'role',             v_inv.role::text,
    'full_name',        p_full_name
  )
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 13. switch_school RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.switch_school(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT role INTO v_role
  FROM   memberships
  WHERE  user_id   = auth.uid()
    AND  school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  UPDATE users
  SET active_school_id = p_school_id
  WHERE id = auth.uid();

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'active_school_id', p_school_id::text,
    'role',             v_role::text
  )
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.switch_school(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.switch_school(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 14. invite_member RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_member(
  p_email text,
  p_role  user_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_email     text;
  v_inv_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;
  v_email     := lower(trim(p_email));

  -- Reject if there is already an active membership for this email in the school
  IF EXISTS (
    SELECT 1
    FROM   memberships m
    JOIN   users u ON u.id = m.user_id
    WHERE  lower(trim(u.email)) = v_email
      AND  m.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'member_already_exists';
  END IF;

  INSERT INTO invitations (school_id, email, role, invited_by)
  VALUES (v_school_id, v_email, p_role, auth.uid())
  ON CONFLICT (school_id, email) WHERE (status = 'pending') DO NOTHING
  RETURNING id INTO v_inv_id;

  -- If conflict (existing pending invite), return its id so the action can resend
  IF v_inv_id IS NULL THEN
    SELECT id INTO v_inv_id
    FROM   invitations
    WHERE  school_id = v_school_id
      AND  lower(trim(email)) = v_email
      AND  status = 'pending';
  END IF;

  RETURN v_inv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_member(text, user_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.invite_member(text, user_role) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 15. revoke_invitation RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;

  UPDATE invitations
  SET    status = 'revoked'
  WHERE  id        = p_invitation_id
    AND  school_id = v_school_id
    AND  status    = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 16. remove_member RPC
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id   uuid;
  v_target_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;

  SELECT role INTO v_target_role
  FROM   memberships
  WHERE  user_id   = p_user_id
    AND  school_id = v_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  IF v_target_role = 'principal' THEN
    RAISE EXCEPTION 'cannot_remove_principal';
  END IF;

  DELETE FROM memberships
  WHERE  user_id   = p_user_id
    AND  school_id = v_school_id;

  -- If this was the removed user's active school, clear it (or switch to another)
  UPDATE users
  SET active_school_id = (
    SELECT school_id FROM memberships
    WHERE  user_id = p_user_id
    LIMIT  1
  )
  WHERE id = p_user_id
    AND active_school_id = v_school_id;

  -- Clear JWT claims if the removed school was their active one
  UPDATE auth.users
  SET raw_user_meta_data =
    CASE
      WHEN (raw_user_meta_data ->> 'active_school_id')::uuid = v_school_id
      THEN raw_user_meta_data - 'active_school_id' - 'role'
      ELSE raw_user_meta_data
    END
  WHERE id = p_user_id
    AND (raw_user_meta_data ->> 'active_school_id')::uuid = v_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 17. Drop columns now that data has been migrated
-- ──────────────────────────────────────────────────────────
ALTER TABLE users DROP COLUMN IF EXISTS school_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;

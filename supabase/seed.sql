-- ============================================================
-- OpenCourt Database Schema — canonical setup
-- Run via: supabase db reset  (applies migrations then this file)
-- ============================================================

-- 0. Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('principal', 'teacher', 'student_rep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. schools
CREATE TABLE IF NOT EXISTS schools (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  access_token text        UNIQUE NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- 2. users (profile — linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        text NOT NULL,
  email            text UNIQUE NOT NULL,
  active_school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

-- 3. memberships (user ↔ school, with role)
CREATE TABLE IF NOT EXISTS memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. invitations
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

-- 5. courts (per-school)
CREATE TABLE IF NOT EXISTS courts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 6. bookings
CREATE TABLE IF NOT EXISTS bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  court_id   uuid NOT NULL REFERENCES courts(id)  ON DELETE RESTRICT,
  booked_by  uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  date       date NOT NULL,
  start_time time NOT NULL,
  end_time   time NOT NULL,
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);
CREATE INDEX IF NOT EXISTS idx_schools_access_token
  ON schools (access_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_user_school
  ON memberships (user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id
  ON memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_school_id
  ON memberships (school_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_school_email
  ON invitations (school_id, email) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_school_id
  ON invitations (school_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courts_school_name
  ON courts (school_id, name);
CREATE INDEX IF NOT EXISTS idx_courts_school_id
  ON courts (school_id);
CREATE INDEX IF NOT EXISTS idx_bookings_school_date
  ON bookings (school_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_court_date
  ON bookings (court_id, date);

-- 6. RLS — schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members can view their schools"
    ON schools FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM memberships m
        WHERE  m.school_id = schools.id AND m.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. RLS — users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. RLS — memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "View active school members"
    ON memberships FOR SELECT
    USING (
      school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "View own memberships"
    ON memberships FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Principal can add members"
    ON memberships FOR INSERT
    WITH CHECK (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Principal can remove members"
    ON memberships FOR DELETE
    USING (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. RLS — invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- auth.email() is SECURITY DEFINER; a direct SELECT on auth.users here
  -- would run as `authenticated`, which has no privilege on that table.
  CREATE POLICY "Invitees can view their own invitations"
    ON invitations FOR SELECT
    USING (
      lower(trim(email)) = lower(trim(COALESCE(auth.email(), '')))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9b. RLS — courts (members read; principal manages)
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "View active school courts"
    ON courts FOR SELECT
    USING (
      school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Principal can add courts"
    ON courts FOR INSERT
    WITH CHECK (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Principal can update courts"
    ON courts FOR UPDATE
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Principal can delete courts"
    ON courts FOR DELETE
    USING (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9c. RLS — bookings (members read; member creates own; owner/principal deletes)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "View active school bookings"
    ON bookings FOR SELECT
    USING (
      school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can create bookings"
    ON bookings FOR INSERT
    WITH CHECK (
      booked_by = auth.uid()
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner or principal can delete bookings"
    ON bookings FOR DELETE
    USING (
      booked_by = auth.uid()
      OR (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
        AND school_id = COALESCE(
          (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner or principal can update bookings"
    ON bookings FOR UPDATE
    USING (
      booked_by = auth.uid()
      OR (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'principal'
        AND school_id = COALESCE(
          (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid
        )
      )
    )
    WITH CHECK (
      school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. Trigger: auto-create profile after auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  -- inviteUserByEmail also fires this; ON CONFLICT prevents duplicates
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Trigger: sync email changes auth → public
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- 12. create_school RPC
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN RAISE EXCEPTION 'token_generation_failed'; END IF;

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

  -- No default courts: the principal registers the first court in-app.

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

-- 13. accept_invitation RPC
CREATE OR REPLACE FUNCTION public.accept_invitation(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_inv   invitations%ROWTYPE;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv
  FROM   invitations
  WHERE  lower(trim(email)) = lower(trim(v_email))
    AND  status     = 'pending'
    AND  expires_at > now()
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN RAISE EXCEPTION 'no_invitation'; END IF;

  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid() AND school_id = v_inv.school_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO memberships (user_id, school_id, role)
  VALUES (auth.uid(), v_inv.school_id, v_inv.role);

  UPDATE users
  SET active_school_id = v_inv.school_id,
      full_name = CASE WHEN p_full_name <> '' THEN p_full_name ELSE full_name END
  WHERE id = auth.uid();

  UPDATE invitations SET status = 'accepted' WHERE id = v_inv.id;

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

-- 14. switch_school RPC
CREATE OR REPLACE FUNCTION public.switch_school(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT role INTO v_role
  FROM   memberships
  WHERE  user_id = auth.uid() AND school_id = p_school_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_member'; END IF;

  UPDATE users SET active_school_id = p_school_id WHERE id = auth.uid();

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

-- 15. invite_member RPC
CREATE OR REPLACE FUNCTION public.invite_member(p_email text, p_role user_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_email     text;
  v_inv_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;
  v_email     := lower(trim(p_email));

  IF EXISTS (
    SELECT 1 FROM memberships m
    JOIN   users u ON u.id = m.user_id
    WHERE  lower(trim(u.email)) = v_email AND m.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'member_already_exists';
  END IF;

  INSERT INTO invitations (school_id, email, role, invited_by)
  VALUES (v_school_id, v_email, p_role, auth.uid())
  ON CONFLICT (school_id, email) WHERE (status = 'pending') DO NOTHING
  RETURNING id INTO v_inv_id;

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

-- 16. revoke_invitation RPC
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;

  UPDATE invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id AND school_id = v_school_id AND status = 'pending';

  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- 17. remove_member RPC
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id   uuid;
  v_target_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF (auth.jwt() -> 'user_metadata' ->> 'role') <> 'principal' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;

  v_school_id := (auth.jwt() -> 'user_metadata' ->> 'active_school_id')::uuid;

  SELECT role INTO v_target_role
  FROM   memberships
  WHERE  user_id = p_user_id AND school_id = v_school_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_member'; END IF;
  IF v_target_role = 'principal' THEN RAISE EXCEPTION 'cannot_remove_principal'; END IF;

  DELETE FROM memberships WHERE user_id = p_user_id AND school_id = v_school_id;

  -- Switch the removed user's active school, or clear it
  UPDATE users
  SET active_school_id = (
    SELECT school_id FROM memberships WHERE user_id = p_user_id LIMIT 1
  )
  WHERE id = p_user_id AND active_school_id = v_school_id;

  -- Clear JWT claims if this was their active school
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data - 'active_school_id' - 'role'
  WHERE id = p_user_id
    AND (raw_user_meta_data ->> 'active_school_id')::uuid = v_school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;

-- 18. Seed data
INSERT INTO schools (name, access_token)
VALUES ('Escola Teste', 'OC-ABCD-1234')
ON CONFLICT (access_token) DO NOTHING;

-- ============================================================
-- OpenCourt — One-shot database setup (final, secure state)
-- Run this whole file in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- Idempotent and safe to run on an empty, partial, or already-configured
-- database. It forces the schema to the correct end state, so it also
-- REPAIRS a half-applied install (e.g. the original handle_new_user trigger
-- that breaks sign-up). This consolidates seed.sql + the dated migrations;
-- those files remain only as history.
--
-- Also required (one-time, Dashboard): Authentication → turn OFF
-- "Confirm email", otherwise sign-up creates no session and the app
-- bounces to /login instead of /onboarding.
-- ============================================================

-- 0. Enum for user roles
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('principal', 'teacher', 'student_rep');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Tables
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_schools_access_token ON schools(access_token);

-- 3. RLS — schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Remove the legacy world-readable policy if a previous install created it.
-- schools must NOT be readable by the public anon key (it would leak every
-- access token). Token lookups happen only inside the SECURITY DEFINER
-- functions below, which bypass RLS.
DROP POLICY IF EXISTS "Anyone can look up schools by access token" ON schools;

DO $$ BEGIN
  CREATE POLICY "Users can view their own school"
    ON schools FOR SELECT
    USING (
      auth.role() = 'authenticated'
      AND id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. RLS — users (uses JWT claims to avoid self-referencing recursion)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view users in their school"
    ON users FOR SELECT
    USING (
      auth.role() = 'authenticated'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Principals can insert users in their school"
    ON users FOR INSERT
    WITH CHECK (
      auth.role() = 'authenticated'
      AND (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Principals can delete users in their school"
    ON users FOR DELETE
    USING (
      auth.role() = 'authenticated'
      AND (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'principal'
      AND school_id = COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Trigger: auto-create the public.users row on sign-up — but only when
-- school metadata is present. Email/Google sign-ups have no school_id yet
-- (they pick a school on /onboarding), so this MUST skip them, otherwise the
-- NOT NULL school_id constraint makes auth.signUp() fail with
-- "Database error saving new user". This is the fix for the broken sign-up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'school_id' IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, full_name, email, role, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'teacher'::public.user_role
    ),
    (NEW.raw_user_meta_data ->> 'school_id')::uuid
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Trigger: keep public.users.email in sync with auth.users.email
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- 7. RPC: join an existing school with an access token (onboarding "Join" tab).
-- Rejects 'principal' — that role comes only from create_school.
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_access_token text,
  p_full_name text,
  p_role public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_role = 'principal' THEN
    RAISE EXCEPTION 'principal_not_allowed';
  END IF;

  SELECT id INTO v_school_id
  FROM public.schools
  WHERE access_token = p_access_token;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'invalid_access_token';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'already_onboarded';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.users (id, full_name, email, role, school_id)
  VALUES (auth.uid(), p_full_name, v_email, p_role, v_school_id);

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role::text,
      'school_id', v_school_id::text
    )
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, public.user_role) TO authenticated;

-- 8. RPC: create a new school (onboarding "Create" tab). Generates a unique
-- OC-XXXX-XXXX token and provisions the caller as principal.
CREATE OR REPLACE FUNCTION public.create_school(
  p_school_name text,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  -- Unambiguous alphabet: no I/L/O/0/1, still matches ^OC-[A-Z0-9]{4}-[A-Z0-9]{4}$
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_token text;
  v_school_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'already_onboarded';
  END IF;

  LOOP
    v_token := 'OC-'
      || (SELECT string_agg(substr(v_alphabet, (1 + floor(random() * length(v_alphabet)))::int, 1), '')
          FROM generate_series(1, 4))
      || '-'
      || (SELECT string_agg(substr(v_alphabet, (1 + floor(random() * length(v_alphabet)))::int, 1), '')
          FROM generate_series(1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.schools WHERE access_token = v_token);
  END LOOP;

  INSERT INTO public.schools (name, access_token)
  VALUES (p_school_name, v_token)
  RETURNING id INTO v_school_id;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.users (id, full_name, email, role, school_id)
  VALUES (auth.uid(), p_full_name, v_email, 'principal', v_school_id);

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'full_name', p_full_name,
      'role', 'principal',
      'school_id', v_school_id::text
    )
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.create_school(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school(text, text) TO authenticated;

-- 9. Seed data — a test school to join with during development
INSERT INTO schools (name, access_token)
VALUES ('Escola Teste', 'OC-ABCD-1234')
ON CONFLICT (access_token) DO NOTHING;

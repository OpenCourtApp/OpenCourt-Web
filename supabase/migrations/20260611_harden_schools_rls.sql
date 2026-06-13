-- ============================================================
-- OpenCourt — Harden schools RLS + onboarding role
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- Idempotent. Safe to run regardless of which earlier scripts were
-- already applied (depends only on the schools table + complete_onboarding
-- existing, both from seed.sql / 20260609).
-- ============================================================

-- S1 — Stop leaking every school's access_token.
-- The permissive "USING (true)" SELECT policy let anyone (the anon key is
-- public) read all rows of `schools`, exposing every join token. It only
-- existed for the old client-side sign-up lookup, which no longer runs —
-- complete_onboarding() and create_school() read `schools` inside
-- SECURITY DEFINER functions that bypass RLS, so dropping it is safe.
-- The "Users can view their own school" policy (school_id = JWT claim)
-- still covers the legitimate logged-in case.
DROP POLICY IF EXISTS "Anyone can look up schools by access token" ON public.schools;

-- S2 — Block privilege escalation: joining a school with a token must not
-- grant the `principal` role. Principal is provisioned only by create_school
-- (the school creator). Same signature as before; only the role guard is new.
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

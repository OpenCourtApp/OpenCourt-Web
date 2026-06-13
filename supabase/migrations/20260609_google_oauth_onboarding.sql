-- ============================================================
-- OpenCourt — Google OAuth + post-OAuth onboarding
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- Required dashboard configuration (one-time, no code involved):
--   1. Google Cloud Console → create an OAuth 2.0 Client ID
--      (Web application). Authorized redirect URI:
--      https://pmllugwxnbfmspbtzmzm.supabase.co/auth/v1/callback
--   2. Supabase Dashboard → Authentication → Providers → Google:
--      enable and paste the Client ID + Client Secret.
--   3. Supabase Dashboard → Authentication → URL Configuration:
--      add the app's URLs to "Redirect URLs", e.g.
--      http://localhost:3000/auth/callback and
--      https://<production-domain>/auth/callback
-- ============================================================

-- 1. handle_new_user: tolerate sign-ups without school metadata.
--    Google OAuth users have no school_id at sign-up time; they are
--    provisioned later via complete_onboarding(). Email/password
--    sign-ups keep working exactly as before.
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

-- 2. complete_onboarding: provisions an OAuth user after they submit
--    a valid school access token. SECURITY DEFINER so it can insert
--    the profile row and stamp the JWT claims (user_metadata) that the
--    RLS policies and route protection rely on.
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

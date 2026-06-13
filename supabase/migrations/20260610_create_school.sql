-- ============================================================
-- OpenCourt — Create school during onboarding
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- Sign-up no longer asks for an access token. On /onboarding the
-- user either joins an existing school (complete_onboarding, from
-- the previous migration) or creates a new one with this function,
-- becoming its principal. A unique OC-XXXX-XXXX join token is
-- generated server-side.
-- ============================================================

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

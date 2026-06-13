-- ============================================================
-- OpenCourt – First-court onboarding
-- New schools no longer get seeded default courts: the principal
-- registers the first court in-app right after creating the school.
-- Existing schools keep whatever courts they already have.
-- ============================================================

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

-- ============================================================
-- OpenCourt – Courts + Bookings
-- Per-school courts table and the bookings that reference them.
-- Sorts AFTER 20260612_multi_school_invites.sql (needs memberships).
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. courts table (per-school)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_courts_school_name
  ON courts (school_id, name);
CREATE INDEX IF NOT EXISTS idx_courts_school_id
  ON courts (school_id);

-- ──────────────────────────────────────────────────────────
-- 2. bookings table
-- ──────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_bookings_school_date
  ON bookings (school_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_court_date
  ON bookings (court_id, date);

-- ──────────────────────────────────────────────────────────
-- 3. Enable RLS
-- ──────────────────────────────────────────────────────────
ALTER TABLE courts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- 4. RLS — courts (members read; principal manages)
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- 5. RLS — bookings (members read; member creates own; owner/principal deletes)
-- ──────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────
-- 6. Seed default courts on school creation
--    (re-declare create_school, adding the courts INSERT)
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

  -- Seed a starter set of courts for the new school
  INSERT INTO courts (school_id, name)
  VALUES (v_school_id, 'Court A'),
         (v_school_id, 'Court B'),
         (v_school_id, 'Court C');

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
-- 7. Backfill: give existing schools the starter courts
-- ──────────────────────────────────────────────────────────
INSERT INTO courts (school_id, name)
SELECT s.id, c.name
FROM   schools s
CROSS  JOIN (VALUES ('Court A'), ('Court B'), ('Court C')) AS c(name)
WHERE  NOT EXISTS (SELECT 1 FROM courts WHERE school_id = s.id);

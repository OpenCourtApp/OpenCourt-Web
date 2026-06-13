-- ============================================================
-- OpenCourt – Bookings UPDATE policy
-- Lets a booking be edited by its owner, or by the school principal.
-- (SELECT/INSERT/DELETE policies were added in 20260613_bookings.sql.)
-- ============================================================

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

-- ============================================================
-- OpenCourt — Stop trusting user_metadata in RLS  (SECURITY FIX)
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- WHY ─────────────────────────────────────────────────────────
-- Every RLS policy + the principal-only RPCs gated authorization on
--   auth.jwt() -> 'user_metadata' ->> 'active_school_id'   (tenant)
--   auth.jwt() -> 'user_metadata' ->> 'role'               (privilege)
-- user_metadata == auth.users.raw_user_meta_data, which ANY signed-in
-- user can rewrite via supabase.auth.updateUser({ data: {...} }) and bake
-- into their own JWT. PostgREST is reachable directly with the anon key +
-- that JWT, so a single forge grants cross-school read/write and a self-
-- promotion to principal. (Supabase linter: rls_references_user_metadata.)
--
-- WHAT THIS DOES ──────────────────────────────────────────────
-- Re-derives tenant + role from the source-of-truth tables (memberships,
-- users.active_school_id) through SECURITY DEFINER helpers. The helpers
-- bypass RLS, so referencing users/memberships inside their own policies
-- does NOT recurse. user_metadata is left in place as a non-authoritative
-- UX mirror (middleware, sidebar, requirePrincipal) — forging it no longer
-- grants any database access.
--
-- Idempotent: drops-then-creates every policy; functions use OR REPLACE.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. Trustworthy, RLS-bypassing accessors (the source of truth)
-- ──────────────────────────────────────────────────────────
-- SECURITY DEFINER + STABLE: evaluated as the function owner, so they read
-- users/memberships without triggering those tables' RLS (no recursion).

CREATE OR REPLACE FUNCTION public.current_active_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_school_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND school_id = p_school_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_principal_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND school_id = p_school_id
      AND role = 'principal'
  )
$$;

-- ──────────────────────────────────────────────────────────
-- 2. users — own profile, same-active-school read, hardened update
-- ──────────────────────────────────────────────────────────
-- The old "update own profile" policy let a user point active_school_id at
-- ANY school (WITH CHECK only verified id = auth.uid()). That would re-open
-- the same hole one column over, so constrain it to schools they belong to.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      active_school_id IS NULL
      OR public.is_member_of(active_school_id)
    )
  );

DROP POLICY IF EXISTS "Users can view same active school" ON public.users;
CREATE POLICY "Users can view same active school"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id   = users.id
        AND m.school_id = public.current_active_school_id()
    )
  );
-- "Users can view own profile" (id = auth.uid()) is unchanged and kept.

-- ──────────────────────────────────────────────────────────
-- 3. memberships — read active-school members, principal manages
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View active school members" ON public.memberships;
CREATE POLICY "View active school members"
  ON public.memberships FOR SELECT
  USING (school_id = public.current_active_school_id());
-- "View own memberships" (user_id = auth.uid()) is unchanged and kept.

DROP POLICY IF EXISTS "Principal can add members" ON public.memberships;
CREATE POLICY "Principal can add members"
  ON public.memberships FOR INSERT
  WITH CHECK (public.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can remove members" ON public.memberships;
CREATE POLICY "Principal can remove members"
  ON public.memberships FOR DELETE
  USING (public.is_principal_of(school_id));

-- ──────────────────────────────────────────────────────────
-- 4. invitations — principal of the row's school manages
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Principal can manage invitations" ON public.invitations;
CREATE POLICY "Principal can manage invitations"
  ON public.invitations FOR ALL
  USING (public.is_principal_of(school_id))
  WITH CHECK (public.is_principal_of(school_id));
-- "Invitees can view their own invitations" (auth.email() match) is unchanged.

-- ──────────────────────────────────────────────────────────
-- 5. courts — members read active school, principal manages
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View active school courts" ON public.courts;
CREATE POLICY "View active school courts"
  ON public.courts FOR SELECT
  USING (school_id = public.current_active_school_id());

DROP POLICY IF EXISTS "Principal can add courts" ON public.courts;
CREATE POLICY "Principal can add courts"
  ON public.courts FOR INSERT
  WITH CHECK (public.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can update courts" ON public.courts;
CREATE POLICY "Principal can update courts"
  ON public.courts FOR UPDATE
  USING (public.is_principal_of(school_id))
  WITH CHECK (public.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can delete courts" ON public.courts;
CREATE POLICY "Principal can delete courts"
  ON public.courts FOR DELETE
  USING (public.is_principal_of(school_id));

-- ──────────────────────────────────────────────────────────
-- 6. bookings — members read; member creates own; owner/principal mutates
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View active school bookings" ON public.bookings;
CREATE POLICY "View active school bookings"
  ON public.bookings FOR SELECT
  USING (school_id = public.current_active_school_id());

DROP POLICY IF EXISTS "Members can create bookings" ON public.bookings;
CREATE POLICY "Members can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (
    booked_by = auth.uid()
    AND school_id = public.current_active_school_id()
  );

DROP POLICY IF EXISTS "Owner or principal can delete bookings" ON public.bookings;
CREATE POLICY "Owner or principal can delete bookings"
  ON public.bookings FOR DELETE
  USING (
    booked_by = auth.uid()
    OR public.is_principal_of(school_id)
  );

DROP POLICY IF EXISTS "Owner or principal can update bookings" ON public.bookings;
CREATE POLICY "Owner or principal can update bookings"
  ON public.bookings FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR public.is_principal_of(school_id)
  )
  WITH CHECK (school_id = public.current_active_school_id());

-- ──────────────────────────────────────────────────────────
-- 7. RPCs — derive principal + school from the DB, not the JWT
-- ──────────────────────────────────────────────────────────
-- invite_member / revoke_invitation / remove_member previously trusted the
-- forgeable metadata role + active_school_id. Re-point them at the helpers.
-- (create_school, accept_invitation, switch_school already authorize off the
-- tables — they only WRITE metadata as a mirror — so they are left as-is.)

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

  v_school_id := public.current_active_school_id();

  IF v_school_id IS NULL OR NOT public.is_principal_of(v_school_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_email := lower(trim(p_email));

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

  v_school_id := public.current_active_school_id();

  IF v_school_id IS NULL OR NOT public.is_principal_of(v_school_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

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

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  v_school_id := public.current_active_school_id();

  IF v_school_id IS NULL OR NOT public.is_principal_of(v_school_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

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

  UPDATE users
  SET active_school_id = (
    SELECT school_id FROM memberships
    WHERE  user_id = p_user_id
    LIMIT  1
  )
  WHERE id = p_user_id
    AND active_school_id = v_school_id;

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
-- 8. Trigger functions are not a public API — close the RPC surface
-- ──────────────────────────────────────────────────────────
-- handle_new_user() / sync_user_email() run only as AFTER triggers on
-- auth.users; trigger execution does NOT check EXECUTE, so revoking the
-- callable /rest/v1/rpc surface is safe. (linter: 0028/0029.)
REVOKE ALL ON FUNCTION public.handle_new_user()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_user_email()  FROM PUBLIC, anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 9. avatars bucket — drop the broad listing policy
-- ──────────────────────────────────────────────────────────
-- The bucket is public, so object URLs (<img src>) resolve via the public
-- CDN path without any SELECT policy on storage.objects. The broad SELECT
-- policy only adds the ability to .list()/enumerate every file, which the
-- app does not need. (linter: 0025_public_bucket_allows_listing.)
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;

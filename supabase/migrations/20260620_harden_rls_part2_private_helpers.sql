-- ============================================================
-- OpenCourt — Move RLS helpers out of the exposed API schema  (SECURITY)
-- Run this in the Supabase SQL Editor, AFTER
-- 20260620_harden_rls_drop_user_metadata_trust.sql:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- WHY ─────────────────────────────────────────────────────────
-- Part 1 created current_active_school_id()/is_member_of()/is_principal_of()
-- in `public`. Functions there are exposed by PostgREST and get the default
-- EXECUTE-to-PUBLIC grant, so the advisor flags them as anon/authenticated-
-- callable SECURITY DEFINER functions (lints 0028/0029).
--
-- They can't simply be REVOKEd: they're evaluated inside RLS policies, which
-- require EXECUTE for the querying role, and they can't be SECURITY INVOKER
-- (current_active_school_id reads users from a users policy; is_principal_of
-- reads memberships from a memberships policy → infinite recursion). The
-- advisor's own fix applies: move them to a schema PostgREST does not expose.
--
-- WHAT THIS DOES ──────────────────────────────────────────────
-- Recreates the three helpers in a non-exposed `private` schema, re-points
-- every policy + RPC at them, and drops the public copies. Behaviour is
-- identical; only the schema (and thus the RPC surface) changes.
--
-- NOTE: keep `private` OUT of Dashboard → Settings → API → "Exposed schemas"
-- (the default is public + graphql_public, so nothing to do).
--
-- Wrapped in a transaction: all-or-nothing, no half-applied policy set.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- 1. Private schema + helpers (identical bodies, new home)
-- ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS private;

-- Roles need USAGE to resolve the functions during policy evaluation.
-- (A fresh schema grants USAGE to the owner only — not to PUBLIC.)
GRANT USAGE ON SCHEMA private TO authenticated, anon;

CREATE OR REPLACE FUNCTION private.current_active_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT active_school_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.is_member_of(p_school_id uuid)
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

CREATE OR REPLACE FUNCTION private.is_principal_of(p_school_id uuid)
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
-- 2. Re-point every policy at private.* (bodies unchanged otherwise)
-- ──────────────────────────────────────────────────────────

-- users
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      active_school_id IS NULL
      OR private.is_member_of(active_school_id)
    )
  );

DROP POLICY IF EXISTS "Users can view same active school" ON public.users;
CREATE POLICY "Users can view same active school"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id   = users.id
        AND m.school_id = private.current_active_school_id()
    )
  );

-- memberships
DROP POLICY IF EXISTS "View active school members" ON public.memberships;
CREATE POLICY "View active school members"
  ON public.memberships FOR SELECT
  USING (school_id = private.current_active_school_id());

DROP POLICY IF EXISTS "Principal can add members" ON public.memberships;
CREATE POLICY "Principal can add members"
  ON public.memberships FOR INSERT
  WITH CHECK (private.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can remove members" ON public.memberships;
CREATE POLICY "Principal can remove members"
  ON public.memberships FOR DELETE
  USING (private.is_principal_of(school_id));

-- invitations
DROP POLICY IF EXISTS "Principal can manage invitations" ON public.invitations;
CREATE POLICY "Principal can manage invitations"
  ON public.invitations FOR ALL
  USING (private.is_principal_of(school_id))
  WITH CHECK (private.is_principal_of(school_id));

-- courts
DROP POLICY IF EXISTS "View active school courts" ON public.courts;
CREATE POLICY "View active school courts"
  ON public.courts FOR SELECT
  USING (school_id = private.current_active_school_id());

DROP POLICY IF EXISTS "Principal can add courts" ON public.courts;
CREATE POLICY "Principal can add courts"
  ON public.courts FOR INSERT
  WITH CHECK (private.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can update courts" ON public.courts;
CREATE POLICY "Principal can update courts"
  ON public.courts FOR UPDATE
  USING (private.is_principal_of(school_id))
  WITH CHECK (private.is_principal_of(school_id));

DROP POLICY IF EXISTS "Principal can delete courts" ON public.courts;
CREATE POLICY "Principal can delete courts"
  ON public.courts FOR DELETE
  USING (private.is_principal_of(school_id));

-- bookings
DROP POLICY IF EXISTS "View active school bookings" ON public.bookings;
CREATE POLICY "View active school bookings"
  ON public.bookings FOR SELECT
  USING (school_id = private.current_active_school_id());

DROP POLICY IF EXISTS "Members can create bookings" ON public.bookings;
CREATE POLICY "Members can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (
    booked_by = auth.uid()
    AND school_id = private.current_active_school_id()
  );

DROP POLICY IF EXISTS "Owner or principal can delete bookings" ON public.bookings;
CREATE POLICY "Owner or principal can delete bookings"
  ON public.bookings FOR DELETE
  USING (
    booked_by = auth.uid()
    OR private.is_principal_of(school_id)
  );

DROP POLICY IF EXISTS "Owner or principal can update bookings" ON public.bookings;
CREATE POLICY "Owner or principal can update bookings"
  ON public.bookings FOR UPDATE
  USING (
    booked_by = auth.uid()
    OR private.is_principal_of(school_id)
  )
  WITH CHECK (school_id = private.current_active_school_id());

-- ──────────────────────────────────────────────────────────
-- 3. Re-point the principal-only RPCs at private.*
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

  v_school_id := private.current_active_school_id();

  IF v_school_id IS NULL OR NOT private.is_principal_of(v_school_id) THEN
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

  v_school_id := private.current_active_school_id();

  IF v_school_id IS NULL OR NOT private.is_principal_of(v_school_id) THEN
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

  v_school_id := private.current_active_school_id();

  IF v_school_id IS NULL OR NOT private.is_principal_of(v_school_id) THEN
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
-- 4. Drop the now-unreferenced public copies
-- ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.current_active_school_id();
DROP FUNCTION IF EXISTS public.is_member_of(uuid);
DROP FUNCTION IF EXISTS public.is_principal_of(uuid);

COMMIT;

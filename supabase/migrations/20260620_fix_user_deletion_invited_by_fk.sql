-- ============================================================
-- OpenCourt — Fix "cannot delete user" (invitations.invited_by FK)
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
--
-- WHY ─────────────────────────────────────────────────────────
-- invitations.invited_by was declared as `REFERENCES users(id)` with no
-- ON DELETE action, so it defaults to NO ACTION (restrict). Deleting an
-- auth.users row cascades to public.users, which is then blocked whenever
-- that user had sent an invitation — i.e. every principal. Symptom:
-- "update or delete on table users violates foreign key constraint
--  invitations_invited_by_fkey" (or the dashboard's "Database error
-- deleting user"). Unrelated to the RLS hardening migrations.
--
-- FIX ─────────────────────────────────────────────────────────
-- Switch the FK to ON DELETE SET NULL. invited_by is nullable, so a sent
-- invitation simply loses its inviter reference (and stays valid — accept
-- matches on email + status, not invited_by) instead of blocking the delete.
--
-- Idempotent: drops whatever FK currently sits on invited_by, re-adds ours.
-- ============================================================

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT con.conname
  INTO   v_constraint
  FROM   pg_constraint con
  WHERE  con.conrelid = 'public.invitations'::regclass
    AND  con.contype  = 'f'
    AND  con.conkey   = ARRAY[
           (SELECT attnum FROM pg_attribute
            WHERE attrelid = 'public.invitations'::regclass
              AND attname  = 'invited_by')
         ];

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.invitations DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.invitations
  ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

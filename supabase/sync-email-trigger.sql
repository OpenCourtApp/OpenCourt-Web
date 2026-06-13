-- ============================================================
-- OpenCourt — Sync email from auth.users to public.users
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/pmllugwxnbfmspbtzmzm/sql/new
-- ============================================================

-- 1. Function that syncs email
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

-- 2. Trigger on auth.users email change
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;

CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

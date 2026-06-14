-- ============================================================
-- OpenCourt – Profile avatars
-- Creates an `avatars` storage bucket so email+password users can upload a
-- profile photo. The uploaded URL is stored in the user's auth metadata
-- (`raw_user_meta_data.avatar_url`), so no profile table column is needed.
-- (Google users get their photo from the Google identity via auth metadata.)
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1. Public storage bucket ----------------------------------------------------
-- Public read so <img src> works without signed URLs. Writes are still gated by
-- the RLS policies below (a user may only touch files under their own id).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS --------------------------------------------------------------
-- Object path convention: `avatars/<auth.uid()>/<filename>`. The first path
-- segment must equal the caller's id for any write.

DO $$ BEGIN
  CREATE POLICY "Avatar images are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload their own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own avatar"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own avatar"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

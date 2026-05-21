-- ============================================================
-- Add image_url column to messages table
-- Run in Supabase SQL Editor
-- ============================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_url text;

-- Allow authenticated users to upload to message-images bucket
-- (Create the bucket first in Storage if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-images', 'message-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload
DROP POLICY IF EXISTS "Authenticated users can upload message images" ON storage.objects;
CREATE POLICY "Authenticated users can upload message images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-images'
    AND auth.role() = 'authenticated'
  );

-- Storage policy: anyone can read (images are public)
DROP POLICY IF EXISTS "Message images are publicly readable" ON storage.objects;
CREATE POLICY "Message images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'message-images');

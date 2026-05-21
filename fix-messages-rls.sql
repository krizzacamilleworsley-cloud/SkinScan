-- ============================================================
-- Fix messages RLS so doctors can reply to patient messages
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Allow clinicians to update conversations (last_message_at)
DROP POLICY IF EXISTS "Clinicians can update conversations" ON public.conversations;
CREATE POLICY "Clinicians can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('doctor', 'admin')
    )
  );

-- 2. Allow clinicians to insert messages into any conversation
DROP POLICY IF EXISTS "Clinicians can insert messages" ON public.messages;
CREATE POLICY "Clinicians can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('doctor', 'admin')
    )
  );

-- 3. Allow patients to see messages sent by clinicians in their conversations
--    (the existing patient SELECT policy only checks conversation ownership, which is correct)

-- Verify policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;

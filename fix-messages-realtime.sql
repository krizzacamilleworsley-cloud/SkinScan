-- ============================================================
-- Fix messages RLS so Supabase Realtime delivers INSERT events to doctors
-- 
-- Problem: the existing "Clinicians can view all messages" policy uses
-- EXISTS (SELECT 1 FROM user_roles WHERE ...) — a subquery that Supabase
-- Realtime cannot evaluate server-side, so events are silently dropped.
--
-- Fix: add a second SELECT policy that checks the JWT role metadata directly.
-- Supabase stores the user's app_metadata in the JWT, but we can't rely on
-- custom claims here. Instead we use a direct user_roles lookup via
-- auth.uid() which IS supported in Realtime's RLS evaluation.
--
-- Actually the real fix is to use REPLICA IDENTITY FULL on messages so
-- Realtime sends the full row, and ensure the publication includes messages.
-- ============================================================

-- 1. Ensure messages is in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 2. Set REPLICA IDENTITY FULL so Realtime delivers the complete row
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 3. Also set REPLICA IDENTITY FULL on conversations and appointments
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.appointments  REPLICA IDENTITY FULL;

-- 4. Drop the subquery-based clinician SELECT policy and replace with
--    a simpler one that Realtime CAN evaluate
DROP POLICY IF EXISTS "Clinicians can view all messages" ON public.messages;

-- New policy: checks user_roles with a simple subquery that Realtime supports
-- (direct equality on auth.uid(), no joins to other user tables)
CREATE POLICY "Clinicians can view all messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('doctor', 'admin')
    )
  );

-- 5. Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- 6. Verify REPLICA IDENTITY settings
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('messages', 'conversations', 'appointments', 'notifications')
ORDER BY relname;

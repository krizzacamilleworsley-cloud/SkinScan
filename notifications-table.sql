-- ============================================================
-- SkinScan AI — Notifications table (clean re-run)
-- Paste into Supabase SQL Editor → Run
-- ============================================================

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('appointment', 'message', 'scan')),
  title        text NOT NULL,
  body         text NOT NULL,
  link         text,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies on this table (clean slate)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- 4. Recreate policies

-- SELECT: users see only their own notifications
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- INSERT: any authenticated user can insert for any recipient
-- Using TRUE so there is absolutely no restriction beyond being authenticated
CREATE POLICY "notif_insert"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: users can only update their own
CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- DELETE: users can only delete their own
CREATE POLICY "notif_delete"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- 5. Index
CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON public.notifications (recipient_id, created_at DESC);

-- 6. Realtime (safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 7. REPLICA IDENTITY FULL — required for Realtime to deliver full row data
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 8. Verify policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd;

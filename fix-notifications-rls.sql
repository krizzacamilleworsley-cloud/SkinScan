-- ============================================================
-- COMPLETE NOTIFICATION SYSTEM RESET
-- Uses DB triggers to create notifications — bypasses RLS entirely
-- Paste entire file into Supabase SQL Editor → Run
-- ============================================================

-- ── 1. Drop and recreate notifications table ─────────────────────────────────
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('appointment', 'message', 'scan')),
  title        text NOT NULL,
  body         text NOT NULL,
  link         text,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ── 2. RLS — users only see/modify their own notifications ────────────────────
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = recipient_id);

CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

CREATE POLICY "notif_delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- INSERT is handled by triggers (SECURITY DEFINER) — no client insert needed
-- But keep a permissive insert policy so the app can still insert directly
CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 3. Index ──────────────────────────────────────────────────────────────────
CREATE INDEX notifications_recipient_idx
  ON public.notifications (recipient_id, created_at DESC);

-- ── 4. Realtime ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 5. Helper: get all doctor/admin user IDs ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_doctor_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT user_id FROM public.user_roles
    WHERE role IN ('doctor', 'admin')
  );
$$;

-- ── 6. Trigger: new message → notify recipient ────────────────────────────────
-- When a message is inserted, notify the other party:
--   • If sender is the conversation owner (patient) → notify all doctors
--   • If sender is a doctor/admin → notify the conversation owner (patient)
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  conv_owner_id uuid;
  sender_is_doctor boolean;
  preview text;
  doctor_id uuid;
BEGIN
  -- Get conversation owner
  SELECT user_id INTO conv_owner_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  -- Is sender a doctor/admin?
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.sender_id AND role IN ('doctor', 'admin')
  ) INTO sender_is_doctor;

  -- Build preview (first 80 chars)
  preview := LEFT(COALESCE(NEW.body, 'Sent an image'), 80);

  IF sender_is_doctor THEN
    -- Doctor sent → notify the patient (conversation owner)
    -- Don't notify if sender IS the owner (shouldn't happen but guard anyway)
    IF NEW.sender_id <> conv_owner_id THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link)
      VALUES (conv_owner_id, 'message', 'New reply from your clinician', preview, '/messages');
    END IF;
  ELSE
    -- Patient sent → notify all doctors/admins
    FOR doctor_id IN
      SELECT user_id FROM public.user_roles WHERE role IN ('doctor', 'admin')
    LOOP
      INSERT INTO public.notifications (recipient_id, type, title, body, link)
      VALUES (doctor_id, 'message', 'New patient message', preview, '/messages');
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_message ON public.messages;
CREATE TRIGGER trg_notify_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ── 7. Trigger: new appointment → notify doctors ──────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_appointment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  doctor_id uuid;
  date_str text;
BEGIN
  date_str := TO_CHAR(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, YYYY');

  FOR doctor_id IN
    SELECT user_id FROM public.user_roles WHERE role IN ('doctor', 'admin')
  LOOP
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      doctor_id, 'appointment',
      'New appointment request',
      'A patient has booked a consultation for ' || date_str || '.',
      '/appointments'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_appointment_insert ON public.appointments;
CREATE TRIGGER trg_notify_on_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment_insert();

-- ── 8. Trigger: appointment status change → notify patient ───────────────────
CREATE OR REPLACE FUNCTION public.notify_on_appointment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  msg text;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  msg := CASE NEW.status
    WHEN 'confirmed' THEN 'Your appointment has been confirmed by the clinic.'
    WHEN 'cancelled' THEN 'Your appointment has been cancelled.'
    WHEN 'completed' THEN 'Your appointment has been marked as completed.'
    ELSE NULL
  END;

  IF msg IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      NEW.user_id, 'appointment',
      'Appointment ' || NEW.status,
      msg,
      '/appointments'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_appointment_update ON public.appointments;
CREATE TRIGGER trg_notify_on_appointment_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment_update();

-- ── 9. Trigger: scan reviewed → notify patient ───────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_scan_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  msg text;
  ttl text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'completed' THEN
      ttl := 'Scan analysis complete';
      msg := 'Your scan result is ready.' ||
             COALESCE(' Risk: ' || NEW.risk_level || '.', '') ||
             COALESCE(' Finding: ' || NEW.prediction || '.', '');
    WHEN 'reviewed' THEN
      ttl := 'Doctor reviewed your scan';
      msg := 'A clinician has reviewed your scan and added their assessment.';
    WHEN 'failed' THEN
      ttl := 'Scan analysis failed';
      msg := 'There was a problem analyzing your scan. Please try again.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (NEW.user_id, 'scan', ttl, msg, '/scans/' || NEW.id::text);

  -- Also notify doctors when a scan is ready for review
  IF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT user_id, 'scan',
      'New scan ready for review',
      'A patient scan has been analyzed and is awaiting your clinical review.' ||
        CASE WHEN NEW.risk_level = 'high' THEN ' ⚠️ High risk.' ELSE '' END,
      '/scans/' || NEW.id::text
    FROM public.user_roles WHERE role IN ('doctor', 'admin');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_scan_update ON public.scans;
CREATE TRIGGER trg_notify_on_scan_update
  AFTER UPDATE ON public.scans
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_scan_update();

-- ── 10. Force PostgREST schema reload ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 11. Verify ───────────────────────────────────────────────────────────────
SELECT 'policy' AS kind, policyname AS name, cmd AS detail
FROM pg_policies WHERE tablename = 'notifications'
UNION ALL
SELECT 'trigger', trigger_name, event_object_table || ' ' || event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('messages','appointments','scans')
  AND trigger_name LIKE 'trg_notify%'
ORDER BY 1, 2;

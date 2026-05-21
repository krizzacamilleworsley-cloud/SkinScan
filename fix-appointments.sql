-- ============================================================
-- Run this in Supabase SQL Editor
-- Adds clinic_id column and doctor update policy
-- ============================================================

-- 1. Add clinic_id column (safe if already exists)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS clinic_id text;

-- 2. Add policy so doctors can confirm/complete appointments
--    (drop first in case it was partially created)
DROP POLICY IF EXISTS "Clinicians can update all appointments" ON public.appointments;

CREATE POLICY "Clinicians can update all appointments"
  ON public.appointments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('doctor', 'admin')
    )
  );

-- 3. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'appointments'
ORDER BY ordinal_position;

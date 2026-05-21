-- ============================================================
-- Fix scans RLS: patients can only read their own scans
-- Clinicians (doctor/admin) can read all scans
-- Run in Supabase SQL Editor
-- ============================================================

-- Drop any existing permissive scan SELECT policies
DROP POLICY IF EXISTS "Users can view own scans" ON public.scans;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.scans;
DROP POLICY IF EXISTS "Patients can view own scans" ON public.scans;
DROP POLICY IF EXISTS "Clinicians can view all scans" ON public.scans;

-- Enable RLS (safe if already enabled)
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- 1. Patients can only SELECT their own scans
CREATE POLICY "Patients can view own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Clinicians (doctor/admin) can SELECT all scans
CREATE POLICY "Clinicians can view all scans"
  ON public.scans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('doctor', 'admin')
    )
  );

-- 3. Patients can INSERT their own scans
DROP POLICY IF EXISTS "Patients can insert own scans" ON public.scans;
CREATE POLICY "Patients can insert own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Patients can UPDATE their own scans (status changes during analysis)
DROP POLICY IF EXISTS "Patients can update own scans" ON public.scans;
CREATE POLICY "Patients can update own scans"
  ON public.scans FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Clinicians can UPDATE any scan (to submit doctor_review, change status)
DROP POLICY IF EXISTS "Clinicians can update all scans" ON public.scans;
CREATE POLICY "Clinicians can update all scans"
  ON public.scans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('doctor', 'admin')
    )
  );

-- Verify
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'scans'
ORDER BY policyname;

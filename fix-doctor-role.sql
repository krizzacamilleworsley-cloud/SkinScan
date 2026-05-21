-- ============================================================
-- RUN THIS AS QUERY 1 (alone, by itself)
-- Adds the missing enum values — must commit before using them
-- ============================================================
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'patient';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'doctor';

-- ============================================================
-- Assign correct roles to test accounts
-- Safe to run multiple times
-- ============================================================

-- Remove any existing roles for these accounts first (clean slate)
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'patient@skinscan.test',
    'doctor@skinscan.test',
    'admin@skinscan.test'
  )
);

-- Insert correct roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'patient'
FROM auth.users WHERE email = 'patient@skinscan.test';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'doctor'
FROM auth.users WHERE email = 'doctor@skinscan.test';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users WHERE email = 'admin@skinscan.test';

-- Verify — should show 3 rows with correct roles
SELECT u.email, r.role
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email IN (
  'patient@skinscan.test',
  'doctor@skinscan.test',
  'admin@skinscan.test'
)
ORDER BY u.email;

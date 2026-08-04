UPDATE public.app_settings SET value = 'chief.of.staff@programming.com' WHERE key = 'chief_of_staff_email' AND value LIKE '%example.com';
INSERT INTO public.app_settings (key, value)
SELECT 'chief_of_staff_email', 'chief.of.staff@programming.com'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'chief_of_staff_email');
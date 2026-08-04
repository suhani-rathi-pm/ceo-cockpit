REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO service_role;
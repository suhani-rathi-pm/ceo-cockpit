CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $reset$
DECLARE
  result jsonb;
BEGIN
  -- WHERE true: the connection role blocks unqualified DELETEs.
  DELETE FROM public.actions WHERE true;
  DELETE FROM public.state_history WHERE true;
  DELETE FROM public.score_runs WHERE true;
  DELETE FROM public.news_items WHERE true;
  DELETE FROM public.touchpoints WHERE true;
  DELETE FROM public.contacts WHERE true;
  DELETE FROM public.companies WHERE true;
  DELETE FROM public.crms WHERE true;

  INSERT INTO public.crms SELECT * FROM public.demo_seed_crms;
  INSERT INTO public.companies SELECT * FROM public.demo_seed_companies;
  INSERT INTO public.contacts SELECT * FROM public.demo_seed_contacts;
  INSERT INTO public.touchpoints SELECT * FROM public.demo_seed_touchpoints;
  INSERT INTO public.news_items SELECT * FROM public.demo_seed_news_items;

  SELECT jsonb_build_object(
    'companies', (SELECT count(*) FROM public.companies),
    'contacts', (SELECT count(*) FROM public.contacts),
    'crms', (SELECT count(*) FROM public.crms),
    'touchpoints', (SELECT count(*) FROM public.touchpoints),
    'news_items', (SELECT count(*) FROM public.news_items)
  ) INTO result;

  RETURN result;
END;
$reset$;

REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO service_role;
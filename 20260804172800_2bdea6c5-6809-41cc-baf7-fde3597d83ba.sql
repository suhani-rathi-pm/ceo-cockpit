-- Private snapshot of the pristine demo dataset (no API grants: backend-only).
CREATE TABLE public.demo_seed_crms AS SELECT * FROM public.crms;
CREATE TABLE public.demo_seed_companies AS SELECT * FROM public.companies;
CREATE TABLE public.demo_seed_contacts AS SELECT * FROM public.contacts;
CREATE TABLE public.demo_seed_touchpoints AS SELECT * FROM public.touchpoints;
CREATE TABLE public.demo_seed_news_items AS SELECT * FROM public.news_items;

-- Snapshot news as undismissed, so a reset always restores a full briefing.
UPDATE public.demo_seed_news_items SET dismissed = false;

ALTER TABLE public.demo_seed_crms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_seed_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_seed_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_seed_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_seed_news_items ENABLE ROW LEVEL SECURITY;

-- Restores the prototype to its original state so it can be demoed repeatedly.
CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $reset$
DECLARE
  result jsonb;
BEGIN
  DELETE FROM public.actions;
  DELETE FROM public.state_history;
  DELETE FROM public.score_runs;
  DELETE FROM public.news_items;
  DELETE FROM public.touchpoints;
  DELETE FROM public.contacts;
  DELETE FROM public.companies;
  DELETE FROM public.crms;

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
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO anon, authenticated, service_role;
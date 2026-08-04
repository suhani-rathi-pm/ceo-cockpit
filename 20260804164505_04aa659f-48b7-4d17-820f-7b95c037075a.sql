-- ============ SCHEMA ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text NOT NULL,
  headcount_band text NOT NULL,
  icp_fit text NOT NULL DEFAULT 'Unknown' CHECK (icp_fit IN ('High','Medium','Low','Unknown')),
  icp_subscores jsonb,
  is_active boolean NOT NULL DEFAULT true,
  inactive_marked_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  title text NOT NULL,
  seniority_tier integer NOT NULL CHECK (seniority_tier BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  experience_level text NOT NULL,
  credibility_multiplier numeric NOT NULL DEFAULT 1.0
);

CREATE TABLE public.touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  crm_id uuid REFERENCES public.crms(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('Meeting','Call','Email','Event')),
  star_rating integer CHECK (star_rating BETWEEN 1 AND 5),
  est_opportunity_size text NOT NULL DEFAULT 'Unknown'
    CHECK (est_opportunity_size IN ('$1M+','$250k-1M','$50k-250k','<$50k','Unknown','None identified')),
  occurred_at timestamptz NOT NULL,
  notes text NOT NULL DEFAULT '',
  misc_comments text,
  CONSTRAINT email_has_no_rating CHECK (type <> 'Email' OR star_rating IS NULL)
);

CREATE TABLE public.score_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT current_date,
  raw_score numeric NOT NULL,
  final_score numeric NOT NULL,
  rank integer,
  classified_state text,
  score_breakdown jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  actor text NOT NULL CHECK (actor IN ('System','Rep','VP','CEO')),
  reason text,
  predicted_state text,
  corrected_state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matched_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  headline text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  published_at timestamptz NOT NULL,
  relevance_score numeric NOT NULL DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 1),
  category text NOT NULL CHECK (category IN ('account_linked','market_sector')),
  why_it_matters text NOT NULL DEFAULT '',
  dismissed boolean NOT NULL DEFAULT false
);

CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  routed_to_unit text NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In progress','Resolved')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_touchpoints_company ON public.touchpoints(company_id);
CREATE INDEX idx_touchpoints_occurred ON public.touchpoints(occurred_at DESC);
CREATE INDEX idx_score_runs_company ON public.score_runs(company_id);
CREATE INDEX idx_news_company ON public.news_items(matched_company_id);

-- ============ GRANTS + RLS (prototype: open demo data, no auth) ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','contacts','crms','touchpoints','score_runs','state_history','news_items','actions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Demo open access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- ============ SEED: CRMs ============
INSERT INTO public.crms (name, experience_level, credibility_multiplier) VALUES
  ('Dana Whitfield', 'Senior (11y)', 1.10),
  ('Marcus Oyelaran', 'Mid (6y)', 1.00),
  ('Priya Raghunathan', 'Senior (9y)', 1.05),
  ('Tom Beckett', 'Junior (2y)', 0.85),
  ('Elise Fontaine', 'Mid (4y)', 0.92);

-- ============ SEED: Companies ============
INSERT INTO public.companies (name, industry, headcount_band, icp_fit, icp_subscores, is_active, inactive_marked_by) VALUES
 ('Northwind Logistics','Logistics','1000-5000','High','{"fit":86,"budget":78,"timing":72,"authority":80}',true,null),
 ('Halcyon Health Group','Healthcare','5000+','High','{"fit":91,"budget":84,"timing":60,"authority":74}',true,null),
 ('Brightline Energy','Energy','500-1000','Medium','{"fit":63,"budget":70,"timing":55,"authority":58}',true,null),
 ('Kestrel Manufacturing','Manufacturing','1000-5000','High','{"fit":88,"budget":66,"timing":81,"authority":69}',true,null),
 ('Vantage Freight Systems','Logistics','200-500','Unknown',null,true,null),
 ('Ориент Retail Group','Retail','5000+','Medium','{"fit":59,"budget":88,"timing":41,"authority":63}',true,null),
 ('Sable & Croft Financial','Financial Services','1000-5000','High','{"fit":90,"budget":92,"timing":48,"authority":85}',true,null),
 ('Meridian Pharma','Pharmaceuticals','5000+','High','{"fit":84,"budget":89,"timing":38,"authority":77}',true,null),
 ('Torrey Cloudworks','Software','200-500','Medium','{"fit":66,"budget":51,"timing":74,"authority":47}',true,null),
 ('Ashcombe Utilities','Utilities','1000-5000','Low','{"fit":34,"budget":62,"timing":29,"authority":55}',true,null),
 ('Pinewood Foods','Food & Beverage','500-1000','Medium','{"fit":61,"budget":57,"timing":66,"authority":52}',true,null),
 ('Calder Marine','Shipping','200-500','Medium','{"fit":58,"budget":49,"timing":63,"authority":44}',true,null),
 ('Loxley Insurance','Insurance','1000-5000','High','{"fit":83,"budget":80,"timing":57,"authority":79}',true,null),
 ('Redstone Mining Co','Mining','5000+','Low','{"fit":31,"budget":75,"timing":22,"authority":60}',false,'VP Sales — flagged dormant Q1'),
 ('Aperture Analytics','Software','50-200','Medium','{"fit":64,"budget":40,"timing":78,"authority":39}',true,null),
 ('Fenwick Property Trust','Real Estate','200-500','Low','{"fit":37,"budget":58,"timing":33,"authority":48}',true,null),
 ('Stellaris Aerospace','Aerospace','1000-5000','High','{"fit":89,"budget":81,"timing":64,"authority":82}',true,null),
 ('Grayloch Telecom','Telecom','5000+','Medium','{"fit":62,"budget":86,"timing":45,"authority":68}',true,null),
 ('Havenbrook Education','Education','500-1000','Low','{"fit":28,"budget":35,"timing":40,"authority":42}',false,'CEO — deprioritised, no budget cycle'),
 ('Orchard Row Hospitality','Hospitality','200-500','Medium','{"fit":56,"budget":47,"timing":69,"authority":50}',true,null);

-- ============ SEED: Contacts, Touchpoints, News ============
DO $$
DECLARE
  co record;
  first_names text[] := ARRAY['Amelia','James','Priyanka','Oscar','Neve','Daniel','Sofia','Rahul','Clara','Bennett','Yusuf','Lena','Marcus','Freya','Tobias','Ines','Callum','Nadia','Simon','Harriet','Omar','Cecily','Victor','Mei','Douglas'];
  last_names text[] := ARRAY['Hargreaves','Okafor','Lindqvist','Marchetti','Whitlock','Barros','Nakamura','Devereux','Ellison','Frost','Adeyemi','Kowalski','Brennan','Sandoval','Ashby','Petrova','Gallagher','Rahim','Vance','Thorne'];
  titles text[] := ARRAY['Chief Executive Officer','Chief Financial Officer','Chief Operating Officer','VP Operations','VP Procurement','Director of Logistics','Head of Supply Chain','Senior Procurement Manager','Operations Manager','Procurement Analyst'];
  tiers integer[] := ARRAY[1,1,1,2,2,3,3,4,4,5];
  notes_pool text[] := ARRAY[
    'Walked through the current workflow; several manual handoffs flagged.',
    'Discussed rollout timeline, wants a phased pilot in two regions.',
    'Budget owner not in the room, follow-up scheduled.',
    'Raised concerns about integration with their legacy stack.',
    'Asked for reference customers in the same sector.',
    'Short catch-up, mostly relationship maintenance.',
    'Procurement wants a formal RFP before any commitment.',
    'Enthusiastic about the analytics module specifically.',
    'Met at industry event, exchanged next steps informally.',
    'Follow-up on pricing sent earlier in the week.'];
  misc_pool text[] := ARRAY[
    'Very warm reception, definitely one to prioritise',
    'Felt lukewarm honestly — might be a tyre-kicker',
    'They mentioned a competitor pitch last month',
    'CFO seems to be the real blocker here',
    'Could be a big one if timing lines up',
    'Third meeting and still no clear owner',
    'Would benefit from a CEO-level nudge',
    'Note: contact is leaving in the new year'];
  crm_ids uuid[];
  contact_ids uuid[];
  cid uuid;
  n_contacts integer;
  i integer;
  ti integer;
  tp_type text;
  n_tps integer;
  min_days integer;
  max_days integer;
  is_stale boolean;
  rating integer;
  opp text;
BEGIN
  SELECT array_agg(id ORDER BY name) INTO crm_ids FROM public.crms;
  PERFORM setseed(0.4242);

  FOR co IN SELECT id, name, icp_fit, is_active FROM public.companies ORDER BY name LOOP
    -- contacts: 2-3 per company (~49 total)
    n_contacts := 2 + (CASE WHEN random() < 0.45 THEN 1 ELSE 0 END);
    FOR i IN 1..n_contacts LOOP
      ti := 1 + floor(random() * array_length(titles,1))::int;
      INSERT INTO public.contacts (company_id, full_name, title, seniority_tier)
      VALUES (
        co.id,
        first_names[1 + floor(random()*array_length(first_names,1))::int] || ' ' ||
        last_names[1 + floor(random()*array_length(last_names,1))::int],
        titles[ti],
        tiers[ti]
      );
    END LOOP;

    SELECT array_agg(id) INTO contact_ids FROM public.contacts WHERE company_id = co.id;

    -- companies deliberately stale (no touchpoint in last 60 days)
    is_stale := co.name IN ('Fenwick Property Trust','Ashcombe Utilities','Calder Marine','Havenbrook Education')
                OR NOT co.is_active;
    IF is_stale THEN
      min_days := 62; max_days := 120;
    ELSE
      min_days := 1; max_days := 118;
    END IF;

    n_tps := CASE
      WHEN NOT co.is_active THEN 3
      WHEN co.icp_fit = 'High' THEN 9 + floor(random()*3)::int
      WHEN co.icp_fit = 'Medium' THEN 6 + floor(random()*3)::int
      ELSE 4 + floor(random()*2)::int
    END;

    FOR i IN 1..n_tps LOOP
      tp_type := (ARRAY['Meeting','Call','Email','Email','Call','Meeting','Event'])[1 + floor(random()*7)::int];
      rating := CASE WHEN tp_type = 'Email' THEN NULL ELSE 2 + floor(random()*4)::int END;
      opp := (ARRAY['$1M+','$250k-1M','$50k-250k','<$50k','Unknown','None identified','$250k-1M','$50k-250k'])[1 + floor(random()*8)::int];
      cid := contact_ids[1 + floor(random()*array_length(contact_ids,1))::int];

      INSERT INTO public.touchpoints (company_id, contact_id, crm_id, type, star_rating, est_opportunity_size, occurred_at, notes, misc_comments)
      VALUES (
        co.id,
        cid,
        crm_ids[1 + floor(random()*array_length(crm_ids,1))::int],
        tp_type,
        rating,
        opp,
        now() - ((min_days + floor(random()*(max_days-min_days)))::int || ' days')::interval - (floor(random()*8)::int || ' hours')::interval,
        notes_pool[1 + floor(random()*array_length(notes_pool,1))::int],
        CASE WHEN random() < 0.33 THEN misc_pool[1 + floor(random()*array_length(misc_pool,1))::int] ELSE NULL END
      );
    END LOOP;
  END LOOP;
END $$;

-- ============ SEED: News items ============
INSERT INTO public.news_items (matched_company_id, headline, source_name, source_url, published_at, relevance_score, category, why_it_matters)
SELECT c.id, v.headline, v.source_name, v.source_url, v.published_at, v.relevance, 'account_linked', v.why
FROM (VALUES
 ('Northwind Logistics','Northwind Logistics raises $120M Series D to expand European network','Reuters','https://www.reuters.com/business/northwind-logistics-series-d-funding/', now() - interval '2 days', 0.94, 'Fresh capital plus a stated expansion plan means budget is unlocked right now — worth a CEO-level call this week.'),
 ('Halcyon Health Group','Halcyon Health Group names former Cigna exec as Chief Operating Officer','Modern Healthcare','https://www.modernhealthcare.com/providers/halcyon-health-appoints-coo/', now() - interval '4 days', 0.88, 'New COO typically reviews vendor contracts in the first 90 days — a warm introduction now beats a cold one in six months.'),
 ('Sable & Croft Financial','Sable & Croft to open Singapore hub, adding 400 roles','Financial Times','https://www.ft.com/content/sable-croft-singapore-expansion', now() - interval '6 days', 0.82, 'APAC expansion creates a net-new operational footprint that maps directly to our platform scope.'),
 ('Stellaris Aerospace','Stellaris Aerospace wins $600M defence subcontract','Aviation Week','https://aviationweek.com/defense/stellaris-aerospace-defence-subcontract', now() - interval '9 days', 0.79, 'Large programme win usually pulls procurement timelines forward — the timing subscore should be re-read.'),
 ('Kestrel Manufacturing','Kestrel Manufacturing announces Ohio plant automation programme','Industry Week','https://www.industryweek.com/operations/kestrel-ohio-automation-programme', now() - interval '11 days', 0.76, 'Automation spend signals appetite for exactly the workflow problem our last three meetings surfaced.'),
 ('Meridian Pharma','Meridian Pharma restructures commercial division under new CFO','Endpoints News','https://endpts.com/meridian-pharma-commercial-restructure/', now() - interval '15 days', 0.68, 'Restructure explains the stalled timing subscore; the new CFO is the decision path we have been missing.'),
 ('Grayloch Telecom','Grayloch Telecom confirms merger talks with regional carrier','Bloomberg','https://www.bloomberg.com/news/articles/grayloch-telecom-merger-talks', now() - interval '18 days', 0.71, 'Merger activity usually freezes new vendor decisions — worth downgrading urgency rather than chasing.')
) AS v(company, headline, source_name, source_url, published_at, relevance, why)
JOIN public.companies c ON c.name = v.company;

INSERT INTO public.news_items (matched_company_id, headline, source_name, source_url, published_at, relevance_score, category, why_it_matters) VALUES
 (null,'Freight rates fall for a fifth consecutive month as capacity outpaces demand','Journal of Commerce','https://www.joc.com/article/freight-rates-fall-fifth-month', now() - interval '3 days', 0.64,'market_sector','Margin pressure across logistics accounts means cost-reduction framing will land better than growth framing this quarter.'),
 (null,'EU supply chain due diligence rules take effect for large manufacturers','Politico Europe','https://www.politico.eu/article/eu-supply-chain-due-diligence-rules', now() - interval '7 days', 0.72,'market_sector','Compliance deadlines create a forced buying event for several manufacturing and logistics accounts in the pipeline.'),
 (null,'Enterprise software budgets flat for 2026, with reallocation toward automation','Gartner Newsroom','https://www.gartner.com/en/newsroom/enterprise-software-budgets-2026', now() - interval '12 days', 0.58,'market_sector','Flat budgets with internal reallocation favour displacement pitches over net-new line items.'),
 (null,'Insurance carriers accelerate claims automation after record catastrophe year','Insurance Journal','https://www.insurancejournal.com/news/national/claims-automation-acceleration', now() - interval '16 days', 0.61,'market_sector','Directly relevant to the two insurance accounts currently sitting mid-funnel.'),
 (null,'Port congestion easing on US West Coast, shifting inland logistics volumes','Supply Chain Dive','https://www.supplychaindive.com/news/west-coast-port-congestion-easing', now() - interval '21 days', 0.49,'market_sector','Volume shifts change which regional operations leaders hold influence inside shipping accounts.');

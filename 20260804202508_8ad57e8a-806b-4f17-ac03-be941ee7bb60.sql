-- 1. Source trail on touchpoints -------------------------------------------
ALTER TABLE public.touchpoints
  ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'Manual entry',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS source_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric,
  ADD COLUMN IF NOT EXISTS source_excerpt text;

UPDATE public.touchpoints SET
  source_system = CASE type
    WHEN 'Meeting' THEN 'Granola'
    WHEN 'Call' THEN 'Aircall'
    WHEN 'Email' THEN 'Gmail sync'
    ELSE 'Manual entry' END,
  source_ref = CASE type
    WHEN 'Meeting' THEN 'granola/note/' || left(replace(id::text, '-', ''), 10)
    WHEN 'Call' THEN 'aircall/call/' || left(replace(id::text, '-', ''), 8)
    WHEN 'Email' THEN 'gmail/thread/' || left(replace(id::text, '-', ''), 12)
    ELSE 'crm-form/' || left(replace(id::text, '-', ''), 6) END,
  source_captured_at = occurred_at + interval '2 hours',
  extraction_confidence = CASE type
    WHEN 'Meeting' THEN round(0.74 + (('x' || left(replace(id::text, '-', ''), 4))::bit(16)::int % 22) / 100.0, 2)
    WHEN 'Call' THEN round(0.66 + (('x' || left(replace(id::text, '-', ''), 4))::bit(16)::int % 20) / 100.0, 2)
    WHEN 'Email' THEN 0.52
    ELSE NULL END,
  source_excerpt = CASE type
    WHEN 'Meeting' THEN 'Transcript extract: ' || left(coalesce(notes, 'no notes captured'), 90)
    WHEN 'Call' THEN 'Call summary: ' || left(coalesce(notes, 'no notes captured'), 90)
    WHEN 'Email' THEN 'Thread subject line and first reply only — no rating inferred.'
    ELSE NULL END
WHERE source_ref IS NULL;

-- 2. Entity resolution queue -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  source_system text NOT NULL,
  suggested_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  confidence numeric,
  occurrences integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  resolved_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_aliases TO anon, authenticated;
GRANT ALL ON public.entity_aliases TO service_role;
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Demo open access" ON public.entity_aliases;
CREATE POLICY "Demo open access" ON public.entity_aliases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS entity_aliases_status_idx ON public.entity_aliases (status, created_at DESC);

INSERT INTO public.entity_aliases (alias, source_system, suggested_company_id, confidence, occurrences)
SELECT v.alias, v.source_system, c.id, v.confidence, v.occurrences
FROM (VALUES
  ('Vantage Freight', 'Granola', 'Vantage Freight Systems', 0.91, 4),
  ('Vantage Frieght Systems', 'Gmail sync', 'Vantage Freight Systems', 0.78, 2),
  ('Nordwind', 'Aircall', NULL, 0.34, 3),
  ('Halden Group (UK)', 'Gmail sync', NULL, 0.41, 1),
  ('Meridian Ops Team', 'Granola', NULL, 0.46, 2),
  ('Kestrel Labs Ltd', 'CRM import', NULL, 0.55, 1)
) AS v(alias, source_system, match_name, confidence, occurrences)
LEFT JOIN public.companies c ON c.name = v.match_name
WHERE NOT EXISTS (SELECT 1 FROM public.entity_aliases e WHERE e.alias = v.alias);

UPDATE public.entity_aliases a
SET suggested_company_id = c.id, confidence = greatest(a.confidence, 0.62)
FROM public.companies c
WHERE a.suggested_company_id IS NULL
  AND a.status = 'pending'
  AND c.name ILIKE split_part(a.alias, ' ', 1) || '%';

-- 3. Collateral store -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collateral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL,
  industry text,
  owner_unit text NOT NULL,
  url text NOT NULL,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collateral TO anon, authenticated;
GRANT ALL ON public.collateral TO service_role;
ALTER TABLE public.collateral ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Demo open access" ON public.collateral;
CREATE POLICY "Demo open access" ON public.collateral FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.collateral (title, kind, industry, owner_unit, url, summary, updated_at)
SELECT * FROM (VALUES
  ('Platform engineering capability deck', 'Deck', NULL, 'Engineering', 'https://drive.programming.com/d/platform-capability-2026', 'The general capability story — teams, delivery model, reference architecture.', now() - interval '9 days'),
  ('Logistics modernisation case study', 'Case study', 'Logistics', 'Delivery', 'https://drive.programming.com/d/case-logistics-modernisation', 'Freight operator, legacy dispatch replaced in 14 weeks, 31% fewer manual handoffs.', now() - interval '21 days'),
  ('Financial services compliance case study', 'Case study', 'Financial Services', 'Delivery', 'https://drive.programming.com/d/case-fs-compliance', 'Regulated reporting rebuilt with a full audit trail, passed external review first time.', now() - interval '34 days'),
  ('Healthcare data platform case study', 'Case study', 'Healthcare', 'Data', 'https://drive.programming.com/d/case-health-data', 'Patient data consolidated across four systems without touching clinical workflow.', now() - interval '52 days'),
  ('Manufacturing OEE dashboard case study', 'Case study', 'Manufacturing', 'Data', 'https://drive.programming.com/d/case-mfg-oee', 'Line-level telemetry to a single OEE view, rolled out over nine plants.', now() - interval '66 days'),
  ('Retail commerce replatform case study', 'Case study', 'Retail', 'Delivery', 'https://drive.programming.com/d/case-retail-replatform', 'Peak-season commerce replatform delivered ahead of the trading calendar.', now() - interval '17 days'),
  ('Standard rate card 2026', 'Rate card', NULL, 'Commercial', 'https://drive.programming.com/d/rate-card-2026', 'Blended day rates by role and region, valid to December 2026.', now() - interval '6 days'),
  ('Enterprise rate card 2026', 'Rate card', NULL, 'Commercial', 'https://drive.programming.com/d/rate-card-enterprise-2026', 'Volume-committed rates for engagements above 5,000 days.', now() - interval '6 days'),
  ('Security and data residency one-pager', 'One-pager', NULL, 'Security', 'https://drive.programming.com/d/security-one-pager', 'Answers the procurement questions before procurement asks them.', now() - interval '12 days')
) AS v(title, kind, industry, owner_unit, url, summary, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM public.collateral);

-- 4. Generation cache -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  model text,
  content jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_cache TO anon, authenticated;
GRANT ALL ON public.generation_cache TO service_role;
ALTER TABLE public.generation_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Demo open access" ON public.generation_cache;
CREATE POLICY "Demo open access" ON public.generation_cache FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS generation_cache_kind_idx ON public.generation_cache (kind, last_used_at DESC);

-- 5. Outreach drafts --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'Email',
  contact_name text,
  subject text NOT NULL,
  body text NOT NULL,
  collateral_id uuid REFERENCES public.collateral(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Draft',
  created_by text NOT NULL DEFAULT 'CEO',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_drafts TO anon, authenticated;
GRANT ALL ON public.outreach_drafts TO service_role;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Demo open access" ON public.outreach_drafts;
CREATE POLICY "Demo open access" ON public.outreach_drafts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS outreach_drafts_company_idx ON public.outreach_drafts (company_id, created_at DESC);
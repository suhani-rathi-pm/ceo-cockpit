CREATE TABLE public.run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  stage text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_log TO anon, authenticated;
GRANT ALL ON public.run_log TO service_role;
ALTER TABLE public.run_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.run_log FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.model_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  tokens_in integer,
  tokens_out integer,
  outcome text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_calls TO anon, authenticated;
GRANT ALL ON public.model_calls TO service_role;
ALTER TABLE public.model_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.model_calls FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.news_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  headline text NOT NULL DEFAULT '',
  reason text NOT NULL,
  relevance_score numeric,
  actor text NOT NULL DEFAULT 'CEO',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_dismissals TO anon, authenticated;
GRANT ALL ON public.news_dismissals TO service_role;
ALTER TABLE public.news_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.news_dismissals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.model_calls (purpose, provider, model, latency_ms, cost_usd, tokens_in, tokens_out, outcome, created_at) VALUES
  ('Field extraction · Granola transcripts', 'Gemini', 'gemini-2.5-flash', 2140, 0.0031, 8420, 611, 'ok', now() - interval '16 hours'),
  ('Field extraction · email threads', 'Gemini', 'gemini-2.5-flash', 1780, 0.0024, 6310, 502, 'ok', now() - interval '16 hours'),
  ('News significance scoring', 'Gemini', 'gemini-2.5-flash', 3620, 0.0058, 14980, 1204, 'ok', now() - interval '15 hours'),
  ('News significance scoring', 'Gemini', 'gemini-2.5-flash', 4110, 0.0061, 15760, 1288, 'refused low confidence', now() - interval '39 hours'),
  ('Handoff brief', 'Gemini', 'gemini-2.5-flash', 2890, 0.0042, 3120, 486, 'ok', now() - interval '5 hours');

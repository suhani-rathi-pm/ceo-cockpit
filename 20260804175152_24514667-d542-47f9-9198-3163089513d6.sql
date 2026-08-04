ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'route_to_unit',
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS body text;

ALTER TABLE public.actions
  ADD CONSTRAINT actions_type_check CHECK (type IN ('route_to_unit','email_handoff'));

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prototype open access to app settings"
  ON public.app_settings FOR ALL
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value)
VALUES ('chief_of_staff_email', 'chief.of.staff@example.com')
ON CONFLICT (key) DO NOTHING;

WITH ranked AS (
  SELECT sr.company_id, c.name, sr.rank,
         ROW_NUMBER() OVER (ORDER BY sr.rank NULLS LAST) AS n
  FROM public.score_runs sr
  JOIN public.companies c ON c.id = sr.company_id
  WHERE sr.run_date = (SELECT max(run_date) FROM public.score_runs)
    AND sr.rank IS NOT NULL
)
INSERT INTO public.actions (company_id, routed_to_unit, status, note, type, subject, body, created_at, resolved_at)
SELECT r.company_id, s.unit, s.status, s.note, s.type, s.subject,
       replace(s.body, '{company}', r.name),
       now() - (s.age_days || ' days')::interval,
       CASE WHEN s.status = 'Resolved' THEN now() - ((s.age_days - 1) || ' days')::interval ELSE NULL END
FROM ranked r
JOIN (VALUES
  (1, 'Sales', 'Open', 'CEO wants a commercial proposal this week — highest score on the board.', 'route_to_unit', NULL::text, NULL::text, 2),
  (2, 'Chief of Staff', 'Open', 'Delegation brief drafted from today''s run. Drafted, not sent.', 'email_handoff',
      'Handoff: {company} — progress this week',
      E'{company} surfaced top of today''s run on engagement volume and senior contact coverage.\n\nScore and rank are the strongest on the board this week.\n\nLast touchpoint was a senior meeting with a clear budget signal and no blocker raised.\n\nAccount-linked news: recent expansion announcement, which widens the scope we can propose against.\n\nNext step: you own the follow-up. Get a scoped proposal in front of them before Friday and confirm the decision timeline.', 3),
  (3, 'Delivery', 'In progress', 'Scoping capacity for a Q3 start; waiting on their infrastructure detail.', 'route_to_unit', NULL, NULL, 6),
  (4, 'Partnerships', 'In progress', 'Exploring a co-sell route rather than direct.', 'route_to_unit', NULL, NULL, 9),
  (5, 'Chief of Staff', 'Resolved', 'Handoff sent and acknowledged; meeting booked.', 'email_handoff',
      'Handoff: {company} — re-engage before it goes stale',
      E'{company} has slipped without a recent touchpoint despite a strong historic score.\n\nRank held in the top half of the board on prior engagement alone.\n\nLast touchpoint was a positive call, but nothing has been logged since.\n\nNo account-linked news this cycle.\n\nNext step: reopen the conversation this week and put a date in the diary.', 14),
  (6, 'Finance', 'Resolved', 'Credit check cleared; handed back to Sales.', 'route_to_unit', NULL, NULL, 21)
) AS s(n, unit, status, note, type, subject, body, age_days) ON s.n = r.n;
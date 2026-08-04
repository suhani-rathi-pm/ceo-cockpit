-- Threaded CEO -> account owner messages
CREATE TABLE public.ceo_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  crm_name text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceo_messages TO anon, authenticated;
GRANT ALL ON public.ceo_messages TO service_role;
ALTER TABLE public.ceo_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.ceo_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.ceo_messages(id) ON DELETE CASCADE,
  author text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_replies TO anon, authenticated;
GRANT ALL ON public.message_replies TO service_role;
ALTER TABLE public.message_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.message_replies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Touchpoints logged by a CRM, waiting for the next scoring run
CREATE TABLE public.pending_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  submitted_by text NOT NULL,
  type text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  contact_title text NOT NULL DEFAULT '',
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  est_opportunity_size text NOT NULL DEFAULT 'Unknown',
  star_rating integer,
  notes text NOT NULL DEFAULT '',
  misc_comments text,
  status text NOT NULL DEFAULT 'Waiting on next run',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_activity TO anon, authenticated;
GRANT ALL ON public.pending_activity TO service_role;
ALTER TABLE public.pending_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.pending_activity FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Access directory for the super-admin page
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  unit text NOT NULL,
  last_active text NOT NULL DEFAULT 'Not yet signed in',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO anon, authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo open access" ON public.people FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.people (name, email, role, unit, last_active) VALUES
  ('Ishwari Sardesai', 'ishwari@programming.com', 'ceo', 'Executive', 'Today, 06:12'),
  ('Rhea Kapoor', 'rhea@programming.com', 'cos', 'Executive', 'Today, 08:05'),
  ('Tom Bidwell', 'tom@programming.com', 'vp', 'Delivery', 'Today, 09:02'),
  ('Priya Raghunathan', 'priya@programming.com', 'crm', 'Sales — East', 'Today, 08:40'),
  ('Marcus Oyelaran', 'marcus@programming.com', 'crm', 'Sales — West', 'Yesterday, 18:20'),
  ('Dana Whitfield', 'dana@programming.com', 'crm', 'Partnerships', '2 days ago'),
  ('Devika Menon', 'devika@programming.com', 'admin', 'Operations', 'Today, 07:55');

-- CRM-side action kinds
ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_type_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_type_check CHECK (type = ANY (ARRAY[
  'route_to_unit','email_handoff','message_owner',
  'revise_opportunity','flag_for_ceo','collateral_request','mark_inactive'
]));

-- Seed CEO -> owner threads against real owned accounts
WITH owner AS (
  SELECT t.company_id,
         (SELECT c.name FROM public.touchpoints t2 JOIN public.crms c ON c.id = t2.crm_id
          WHERE t2.company_id = t.company_id AND t2.crm_id IS NOT NULL
          ORDER BY t2.occurred_at DESC LIMIT 1) AS crm_name
  FROM (SELECT DISTINCT company_id FROM public.touchpoints) t
), cand AS (
  SELECT sr.company_id, o.crm_name, row_number() OVER (ORDER BY sr.rank) AS rn
  FROM public.score_runs sr
  JOIN owner o ON o.company_id = sr.company_id
  WHERE sr.run_date = (SELECT max(run_date) FROM public.score_runs)
    AND sr.rank IS NOT NULL
    AND o.crm_name IN ('Priya Raghunathan','Marcus Oyelaran','Dana Whitfield')
), msg(rn, body, read_flag, hours_ago) AS (VALUES
  (1, 'This one sits at the top of my board today and the last conversation stopped at the operations layer. Get me in front of their COO before Friday — I want the commercial framing done in person, not over email. Tell me who you need on the call and I will clear the time.', false, 5),
  (2, 'The news on this account changes the timing, not the price. Re-open the conversation this week on the back of it and hold the number where it is. If procurement pushes for a discount, route it to me rather than answering in the room.', false, 9),
  (3, 'We have gone quiet here and I do not want to lose the ground we made in the spring. Book a working session with their delivery lead in the next ten days and log what comes out of it so the next run picks it up.', true, 30),
  (4, 'Opportunity size on this looks conservative against what you described on the call. Revise it if the evidence supports it, and put the reason in the log — I read those.', true, 52)
)
INSERT INTO public.ceo_messages (company_id, crm_name, body, read, created_at)
SELECT c.company_id, c.crm_name, m.body, m.read_flag, now() - (m.hours_ago || ' hours')::interval
FROM cand c JOIN msg m ON m.rn = c.rn;

INSERT INTO public.message_replies (message_id, author, body, created_at)
SELECT id, crm_name, 'Working session is being booked for the week after next — their delivery lead is out until Monday. I will log the outcome the same day.', created_at + interval '4 hours'
FROM public.ceo_messages WHERE read = true
ORDER BY created_at LIMIT 1;

-- One submission already waiting on the next run
INSERT INTO public.pending_activity (company_id, company_name, submitted_by, type, contact_name, contact_title, occurred_on, est_opportunity_size, star_rating, notes, misc_comments)
SELECT sr.company_id, c.name, 'Priya Raghunathan', 'Meeting', 'Ana Ferreira', 'VP Operations', CURRENT_DATE, '$250k-1M', 4,
  'Walked through the phase-two scope with their operations team. They want a fixed-price option before the board meets.',
  'Very warm reception, worth pushing while the budget conversation is live.'
FROM public.score_runs sr JOIN public.companies c ON c.id = sr.company_id
WHERE sr.run_date = (SELECT max(run_date) FROM public.score_runs) AND sr.rank = 1;
ALTER TABLE public.run_log
  ADD COLUMN IF NOT EXISTS pipeline text NOT NULL DEFAULT 'scoring',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS records integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence numeric;
CREATE INDEX IF NOT EXISTS run_log_created_idx ON public.run_log (created_at DESC);
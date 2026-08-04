ALTER TABLE public.actions DROP CONSTRAINT IF EXISTS actions_type_check;
ALTER TABLE public.actions ADD CONSTRAINT actions_type_check CHECK (type IN ('route_to_unit','email_handoff','message_owner'));
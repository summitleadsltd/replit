-- Dialer / queue UI expects these columns on campaign_contacts (safe if already present)
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS assigned_date date;

ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid REFERENCES auth.users(id);

ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'unassigned';

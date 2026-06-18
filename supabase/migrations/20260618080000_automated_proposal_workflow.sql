-- Automated Proposal Workflow
-- Creates proposals from qualified inspections and assigns closers

CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_outcome_id UUID NOT NULL REFERENCES public.appointment_outcomes(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  assigned_closer_id UUID,
  estimated_value NUMERIC,
  proposal_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated can view proposals" ON public.proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage proposals" ON public.proposals
  FOR ALL TO authenticated USING (true);

-- Add status enum for proposals
CREATE TYPE proposal_status AS ENUM (
  'pending',
  'assigned',
  'scheduled',
  'presented',
  'accepted',
  'rejected',
  'cancelled'
);

ALTER TABLE public.proposals
ALTER COLUMN status TYPE proposal_status USING status::proposal_status;

-- Add indexes
CREATE INDEX idx_proposals_outcome ON public.proposals(appointment_outcome_id);
CREATE INDEX idx_proposals_contact ON public.proposals(contact_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_closer ON public.proposals(assigned_closer_id);
CREATE INDEX idx_proposals_date ON public.proposals(proposal_date);

-- Function to auto-create proposal from qualified inspection
CREATE OR REPLACE FUNCTION public.create_proposal_from_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create proposal if outcome is 'qualified' and next_step is 'schedule_proposal'
  IF NEW.outcome = 'qualified' AND NEW.next_step = 'schedule_proposal' THEN
    -- Get the contact_id from the appointment
    DECLARE
      v_contact_id UUID;
    BEGIN
      SELECT contact_id
      INTO v_contact_id
      FROM public.appointments
      WHERE id = NEW.appointment_id;

      IF v_contact_id IS NOT NULL THEN
        INSERT INTO public.proposals (
          appointment_outcome_id,
          contact_id,
          status,
          notes
        ) VALUES (
          NEW.id,
          v_contact_id,
          'pending',
          'Auto-generated from qualified inspection'
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-proposal creation
DROP TRIGGER IF EXISTS on_outcome_insert_create_proposal ON public.appointment_outcomes;
CREATE TRIGGER on_outcome_insert_create_proposal
  AFTER INSERT ON public.appointment_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.create_proposal_from_inspection();

-- Function to assign closer to proposal
CREATE OR REPLACE FUNCTION public.assign_proposal_closer(p_proposal_id UUID, p_closer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.proposals
  SET 
    assigned_closer_id = p_closer_id,
    status = 'assigned',
    updated_at = now()
  WHERE id = p_proposal_id;

  RETURN FOUND;
END;
$$;

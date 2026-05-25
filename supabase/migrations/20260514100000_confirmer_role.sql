-- Confirmer Role + Appointment Confirmation Workflow
-- Adds 'confirmer' role, extends appointments table with confirmation/visit status,
-- creates audit history table, and updates RLS policies.
--
-- NOTE: This migration assumes the 'confirmer' enum value was already added.
-- If not, run: ALTER TYPE public.app_role ADD VALUE 'confirmer';

-- 1. Extend appointments table with confirmation workflow columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (confirmation_status IN ('scheduled', 'confirmed', 'unable_to_reach', 'cancelled', 'rescheduled')),
  ADD COLUMN IF NOT EXISTS visit_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (visit_status IN ('pending', 'completed', 'no_show', 'rescheduled')),
  ADD COLUMN IF NOT EXISTS confirmation_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 3. Index for tomorrow's queue query (confirmation status + date)
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_date
  ON public.appointments(appointment_at, confirmation_status)
  WHERE confirmation_status IN ('scheduled', 'rescheduled');

-- 4. Index for technician calendar
CREATE INDEX IF NOT EXISTS idx_appointments_technician_date
  ON public.appointments(technician_id, appointment_at)
  WHERE visit_status NOT IN ('completed', 'no_show');

-- 5. Appointment status history (audit trail)
CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  status_type TEXT NOT NULL CHECK (status_type IN ('confirmation', 'visit')),
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_history_appointment
  ON public.appointment_status_history(appointment_id, changed_at DESC);

ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

-- 6. RLS for history table (read-only for anyone who can see the appointment)
DROP POLICY IF EXISTS "View appointment history" ON public.appointment_status_history;
CREATE POLICY "View appointment history" ON public.appointment_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_status_history.appointment_id
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR (
            (a.campaign_id IS NULL OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = a.campaign_id AND is_same_company(c.company_id)))
            AND (
              has_role(auth.uid(), 'manager'::app_role)
              OR a.agent_id = auth.uid()
              OR a.confirmer_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.technicians t
                WHERE t.id = a.technician_id AND t.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Insert appointment history" ON public.appointment_status_history;
-- Only allow inserts from the trigger (runs as SECURITY DEFINER) or admin
CREATE POLICY "Insert appointment history" ON public.appointment_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR current_setting('app.is_trigger_context', true) = 'true'
  );

-- 7. updated_at trigger on appointments
CREATE OR REPLACE FUNCTION public.set_appointment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- appointments table doesn't have updated_at yet, add it if needed
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 8. Auto-log status changes to history
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM set_config('app.is_trigger_context', 'true', true);
  IF NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status THEN
    INSERT INTO public.appointment_status_history
      (appointment_id, changed_by_user_id, status_type, old_status, new_status)
    VALUES
      (NEW.id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'confirmation',
       OLD.confirmation_status, NEW.confirmation_status);
  END IF;
  IF NEW.visit_status IS DISTINCT FROM OLD.visit_status THEN
    INSERT INTO public.appointment_status_history
      (appointment_id, changed_by_user_id, status_type, old_status, new_status)
    VALUES
      (NEW.id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'visit', OLD.visit_status, NEW.visit_status);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_appointment_status_log ON public.appointments;
CREATE TRIGGER trg_appointment_status_log
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_appointment_status_change();

-- 9. Update RLS for appointments to allow confirmer access
DROP POLICY IF EXISTS "View appointments" ON public.appointments;
CREATE POLICY "View appointments" ON public.appointments FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (campaign_id IS NULL OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = appointments.campaign_id AND is_same_company(c.company_id)))
    AND (
      has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'confirmer'::app_role)
      OR agent_id = auth.uid()
      OR confirmer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.technicians t
        WHERE t.id = appointments.technician_id AND t.user_id = auth.uid()
      )
      OR (has_role(auth.uid(), 'client'::app_role) AND campaign_id IN (
        SELECT c.id FROM public.campaigns c WHERE c.client_account_id IN (SELECT get_user_client_account_ids(auth.uid()))
      ))
    )
  )
);

-- 10. Allow confirmers (and agents/admins) to insert appointments
DROP POLICY IF EXISTS "Agents can insert appointments" ON public.appointments;
CREATE POLICY "Insert appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = agent_id
    OR has_role(auth.uid(), 'confirmer'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 11. Allow confirmers to update appointments (for rescheduling/status)
DROP POLICY IF EXISTS "Agents can update own appointments" ON public.appointments;
CREATE POLICY "Update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'confirmer'::app_role)
    OR agent_id = auth.uid()
    OR confirmer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.technicians t
      WHERE t.id = appointments.technician_id AND t.user_id = auth.uid()
    )
  );

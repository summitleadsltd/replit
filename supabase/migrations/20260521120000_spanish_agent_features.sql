-- ============================================================================
-- Spanish Agent Features + Live Transfer + Appointment Confirmation
-- Migration: 2026-05-21
-- ============================================================================

-- ============================================================================
-- Phase 1: Extend Enums
-- ============================================================================

-- Add transfer_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_type') THEN
    CREATE TYPE public.transfer_type AS ENUM ('warm', 'cold');
  END IF;
END $$;

-- Add confirmation_status enum if appointment_status doesn't cover it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'failed_to_reach' AND enumtypid = 'public.appointment_status'::regtype) THEN
    ALTER TYPE public.appointment_status ADD VALUE 'failed_to_reach';
  END IF;
END $$;

-- ============================================================================
-- Phase 2: Extend Profiles (Agents/Users)
-- ============================================================================

-- Add language_skills and last_heartbeat_at to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_skills TEXT[] DEFAULT ARRAY['en'],
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS role TEXT NULL;

-- Index for Spanish agent lookups
CREATE INDEX IF NOT EXISTS idx_profiles_language_skills ON public.profiles USING GIN (language_skills);
CREATE INDEX IF NOT EXISTS idx_profiles_heartbeat ON public.profiles(last_heartbeat_at) WHERE last_heartbeat_at IS NOT NULL;

-- ============================================================================
-- Phase 3: Extend Contacts (Leads)
-- ============================================================================

-- Add language and disposition for Spanish queue routing
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS callback_disposition TEXT NULL;

-- Index for Spanish lead queries
CREATE INDEX IF NOT EXISTS idx_contacts_language ON public.contacts(language) WHERE language = 'es';
CREATE INDEX IF NOT EXISTS idx_contacts_callback_disposition ON public.contacts(callback_disposition) WHERE callback_disposition = 'callback_spanish';

-- ============================================================================
-- Phase 4: Extend Call Attempts (Call Logs)
-- ============================================================================

-- Add transfer tracking columns
ALTER TABLE public.call_attempts
  ADD COLUMN IF NOT EXISTS transferred_from_agent_id UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS transferred_to_agent_id UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS transfer_type public.transfer_type NULL;

-- Index for transfer queries
CREATE INDEX IF NOT EXISTS idx_call_attempts_transfer_from ON public.call_attempts(transferred_from_agent_id) WHERE transferred_from_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_attempts_transfer_to ON public.call_attempts(transferred_to_agent_id) WHERE transferred_to_agent_id IS NOT NULL;

-- ============================================================================
-- Phase 5: Extend Appointments
-- ============================================================================

-- Note: technician_id already exists from 20260513094200_technician_app_schema.sql
-- Add confirmation tracking and duration
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'failed_to_reach', 'rescheduled', 'cancelled')),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by_agent_id UUID NULL REFERENCES auth.users(id);

-- Index for confirmation queue
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation ON public.appointments(confirmation_status, appointment_at);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_date ON public.appointments(appointment_at) WHERE confirmation_status = 'pending';

-- ============================================================================
-- Phase 6: Create Agent Presence Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_call', 'away', 'offline')),
  current_call_attempt_id UUID NULL REFERENCES public.call_attempts(id),
  current_room_name TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_presence ENABLE ROW LEVEL SECURITY;

-- RLS: Agents can update their own presence
DROP POLICY IF EXISTS "Agents can manage own presence" ON public.agent_presence;
CREATE POLICY "Agents can manage own presence"
  ON public.agent_presence
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS: Agents can view presence of agents in same company (for transfer panel)
DROP POLICY IF EXISTS "Agents can view company presence" ON public.agent_presence;
CREATE POLICY "Agents can view company presence"
  ON public.agent_presence
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR user_id = auth.uid()
  );

-- Index for presence queries
CREATE INDEX IF NOT EXISTS idx_agent_presence_heartbeat ON public.agent_presence(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_agent_presence_status ON public.agent_presence(status, last_heartbeat_at) WHERE status = 'available';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_agent_presence_updated_at ON public.agent_presence;
CREATE TRIGGER update_agent_presence_updated_at
  BEFORE UPDATE ON public.agent_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Phase 7: Create Daily Lead Assignments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_lead_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id UUID NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'completed', 'skipped')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, contact_id, assigned_date)
);

ALTER TABLE public.daily_lead_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: Agents can view their own assignments
DROP POLICY IF EXISTS "Agents can view own assignments" ON public.daily_lead_assignments;
CREATE POLICY "Agents can view own assignments"
  ON public.daily_lead_assignments
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

-- RLS: Agents can update their own assignments
DROP POLICY IF EXISTS "Agents can update own assignments" ON public.daily_lead_assignments;
CREATE POLICY "Agents can update own assignments"
  ON public.daily_lead_assignments
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid());

-- RLS: System can insert assignments (via edge function)
DROP POLICY IF EXISTS "System can insert assignments" ON public.daily_lead_assignments;
CREATE POLICY "System can insert assignments"
  ON public.daily_lead_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for assignment queries
CREATE INDEX IF NOT EXISTS idx_daily_assignments_agent_date ON public.daily_lead_assignments(agent_id, assigned_date, language);
CREATE INDEX IF NOT EXISTS idx_daily_assignments_agent_status ON public.daily_lead_assignments(agent_id, status, assigned_date);
CREATE INDEX IF NOT EXISTS idx_daily_assignments_contact ON public.daily_lead_assignments(contact_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_daily_assignments_updated_at ON public.daily_lead_assignments;
CREATE TRIGGER update_daily_assignments_updated_at
  BEFORE UPDATE ON public.daily_lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Phase 8: Helper Functions
-- ============================================================================

-- Function: Get available Spanish agents (online + no active call)
CREATE OR REPLACE FUNCTION public.get_available_spanish_agents(p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  email TEXT,
  status TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  current_call_attempt_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.display_name,
    p.email,
    COALESCE(ap.status, 'offline') as status,
    ap.last_heartbeat_at,
    ap.current_call_attempt_id
  FROM public.profiles p
  LEFT JOIN public.agent_presence ap ON ap.user_id = p.user_id
  WHERE 
    -- Spanish speaking agents
    'es' = ANY(COALESCE(p.language_skills, ARRAY['en']))
    -- Online (heartbeat within last 30 seconds)
    AND ap.last_heartbeat_at > now() - interval '30 seconds'
    -- Available (not on a call)
    AND (ap.status = 'available' OR (ap.status = 'on_call' AND ap.current_call_attempt_id IS NULL))
    -- Same company as requesting agent (if company_id provided)
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
    -- Active profile
    AND p.is_active = true
  ORDER BY ap.last_heartbeat_at DESC;
$$;

-- Function: Assign daily leads (fair round-robin)
CREATE OR REPLACE FUNCTION public.assign_daily_leads(
  p_agent_id UUID,
  p_language TEXT DEFAULT 'en',
  p_cap INTEGER DEFAULT 75,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_count INTEGER := 0;
  v_company_id UUID;
BEGIN
  -- Get agent's company
  SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = p_agent_id;
  
  -- Don't exceed cap
  SELECT COUNT(*) INTO v_assigned_count 
  FROM public.daily_lead_assignments 
  WHERE agent_id = p_agent_id 
    AND assigned_date = CURRENT_DATE
    AND language = p_language;
    
  IF v_assigned_count >= p_cap THEN
    RETURN 0;
  END IF;

  -- Insert leads that aren't already assigned today
  WITH available_leads AS (
    SELECT c.id as contact_id
    FROM public.contacts c
    WHERE 
      -- Match language criteria (OR Spanish callback disposition)
      (
        c.language = p_language
        OR (p_language = 'es' AND c.callback_disposition = 'callback_spanish')
      )
      -- Same company
      AND c.company_id = v_company_id
      -- Not already assigned today to any agent
      AND NOT EXISTS (
        SELECT 1 FROM public.daily_lead_assignments dla
        WHERE dla.contact_id = c.id 
          AND dla.assigned_date = CURRENT_DATE
      )
      -- Not in terminal state
      AND c.lead_status NOT IN ('dead', 'converted')
    ORDER BY 
      -- Priority: callback_spanish first, then regular Spanish leads
      CASE WHEN c.callback_disposition = 'callback_spanish' THEN 0 ELSE 1 END,
      c.created_at
    LIMIT (p_cap - v_assigned_count)
  )
  INSERT INTO public.daily_lead_assignments (agent_id, contact_id, campaign_id, language, assigned_date)
  SELECT p_agent_id, contact_id, p_campaign_id, p_language, CURRENT_DATE
  FROM available_leads;

  GET DIAGNOSTICS v_assigned_count = ROW_COUNT;
  RETURN v_assigned_count;
END;
$$;

-- Function: Check technician availability (conflict detection)
CREATE OR REPLACE FUNCTION public.check_technician_availability(
  p_technician_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  is_available BOOLEAN,
  conflicting_appointment_id UUID,
  conflicting_start TIMESTAMPTZ,
  conflicting_end TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH new_range AS (
    SELECT p_scheduled_at as start_time, p_scheduled_at + (p_duration_minutes || ' minutes')::interval as end_time
  ),
  conflicts AS (
    SELECT 
      a.id as appointment_id,
      a.appointment_at as start_time,
      a.appointment_at + (COALESCE(a.duration_minutes, 60) || ' minutes')::interval as end_time
    FROM public.appointments a
    WHERE 
      a.technician_id = p_technician_id
      AND a.confirmation_status NOT IN ('cancelled')
      AND a.appointment_at < (SELECT end_time FROM new_range)
      AND (a.appointment_at + (COALESCE(a.duration_minutes, 60) || ' minutes')::interval) > (SELECT start_time FROM new_range)
    LIMIT 1
  )
  SELECT 
    NOT EXISTS(SELECT 1 FROM conflicts) as is_available,
    (SELECT appointment_id FROM conflicts) as conflicting_appointment_id,
    (SELECT start_time FROM conflicts) as conflicting_start,
    (SELECT end_time FROM conflicts) as conflicting_end;
$$;

-- Function: Get agent daily stats
CREATE OR REPLACE FUNCTION public.get_agent_daily_stats(p_agent_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_assigned BIGINT,
  contacted BIGINT,
  remaining BIGINT,
  language TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_assigned,
    COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
    COUNT(*) FILTER (WHERE status = 'pending') as remaining,
    language
  FROM public.daily_lead_assignments
  WHERE agent_id = p_agent_id AND assigned_date = p_date
  GROUP BY language;
$$;

-- ============================================================================
-- Phase 9: Update Campaign Contacts for Language Filtering
-- ============================================================================

-- Add language column to campaign_contacts if not exists (for filtering)
-- This denormalizes for performance - synced via trigger
ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS contact_language TEXT DEFAULT 'en';

-- Index for Spanish queue filtering
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_language ON public.campaign_contacts(contact_language, campaign_id) WHERE dial_status = 'pending';

-- Function to sync contact language to campaign_contacts
CREATE OR REPLACE FUNCTION public.sync_campaign_contact_language()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.campaign_contacts
  SET contact_language = NEW.language
  WHERE contact_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Trigger to keep language in sync
DROP TRIGGER IF EXISTS sync_contact_language ON public.contacts;
CREATE TRIGGER sync_contact_language
  AFTER UPDATE OF language ON public.contacts
  FOR EACH ROW
  WHEN (OLD.language IS DISTINCT FROM NEW.language)
  EXECUTE FUNCTION public.sync_campaign_contact_language();

-- Backfill existing campaign_contacts
UPDATE public.campaign_contacts cc
SET contact_language = c.language
FROM public.contacts c
WHERE cc.contact_id = c.id AND cc.contact_language IS NULL;

-- ============================================================================
-- Phase 10: RLS for Spanish Agent Lead Access
-- ============================================================================

-- Spanish agents can only see leads assigned to them or in Spanish queue
DROP POLICY IF EXISTS "Spanish agents see Spanish leads" ON public.contacts;
CREATE POLICY "Spanish agents see Spanish leads"
  ON public.contacts
  FOR SELECT
  TO authenticated
  USING (
    -- Admin/manager can see all
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
    OR
    -- Agent can see leads locked to them
    locked_to_agent_id = auth.uid()
    OR
    -- Spanish agent can see Spanish leads in their company
    (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = auth.uid() 
        AND 'es' = ANY(COALESCE(p.language_skills, ARRAY['en']))
      )
      AND language = 'es'
      AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR
    -- Any agent can see their assigned daily leads
    EXISTS (
      SELECT 1 FROM public.daily_lead_assignments dla
      WHERE dla.contact_id = contacts.id
        AND dla.agent_id = auth.uid()
        AND dla.assigned_date = CURRENT_DATE
    )
  );

-- ============================================================================
-- Phase 11: Realtime Setup
-- ============================================================================

-- Enable realtime for agent_presence table
ALTER TABLE public.agent_presence REPLICA IDENTITY FULL;

-- Note: Enable in Supabase Dashboard: Database > Replication > Realtime
-- Check that agent_presence table is enabled

-- ============================================================================
-- Phase 12: Migration Complete
-- ============================================================================

COMMENT ON TABLE public.agent_presence IS 'Real-time agent presence tracking for transfers and queue routing';
COMMENT ON TABLE public.daily_lead_assignments IS 'Daily lead assignments for fair distribution across agents';
COMMENT ON COLUMN public.profiles.language_skills IS 'Array of language codes (e.g., ["en", "es"])';
COMMENT ON COLUMN public.contacts.callback_disposition IS 'Special disposition like callback_spanish for language-specific routing';

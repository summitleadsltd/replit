-- Add missing columns to call_recordings table required by livekit-webhook
-- The webhook inserts agent_id, lead_id, campaign_id, call_session_id, and status
-- but these columns were never added via migration.

ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS campaign_id UUID;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS call_session_id UUID;
ALTER TABLE public.call_recordings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_call_recordings_agent_id ON public.call_recordings(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_campaign_id ON public.call_recordings(campaign_id);

-- Add INSERT policy so webhook (service_role) and agents can insert
DROP POLICY IF EXISTS "Insert call_recordings" ON public.call_recordings;
CREATE POLICY "Insert call_recordings"
  ON public.call_recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR agent_id = auth.uid()
  );

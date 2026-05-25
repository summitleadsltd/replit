-- Fix call_recordings foreign key relationship
-- The table was renamed from recordings to call_recordings but the FK may be broken

-- Drop existing foreign key constraint if it exists
ALTER TABLE public.call_recordings DROP CONSTRAINT IF EXISTS recordings_call_log_id_fkey;
ALTER TABLE public.call_recordings DROP CONSTRAINT IF EXISTS call_recordings_call_attempt_id_fkey;

-- Add proper foreign key constraint to call_attempts
ALTER TABLE public.call_recordings
  ADD CONSTRAINT call_recordings_call_attempt_id_fkey
  FOREIGN KEY (call_attempt_id)
  REFERENCES public.call_attempts(id)
  ON DELETE CASCADE;

-- Ensure RLS is enabled
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policy for call_recordings
DROP POLICY IF EXISTS "View call_recordings" ON public.call_recordings;

CREATE POLICY "View call_recordings"
  ON public.call_recordings
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'team_leader'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.call_attempts ca
      WHERE ca.id = call_recordings.call_attempt_id
        AND ca.agent_id = auth.uid()
    )
  );

-- Ensure call_recordings table exists with correct schema
-- This migration checks if the table exists and recreates it if needed

DO $$
BEGIN
  -- Check if call_recordings table exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_recordings') THEN
    CREATE TABLE public.call_recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_attempt_id UUID REFERENCES public.call_attempts(id) ON DELETE CASCADE,
      telnyx_recording_id TEXT,
      recording_url TEXT,
      download_url TEXT,
      duration_seconds INT,
      format TEXT DEFAULT 'mp3',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy
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
    
    -- Create indexes
    CREATE INDEX idx_call_recordings_call_attempt_id ON public.call_recordings(call_attempt_id);
    CREATE INDEX idx_call_recordings_created_at ON public.call_recordings(created_at DESC);
  END IF;
END $$;

-- Ensure the foreign key constraint exists
DO $$
BEGIN
  -- Drop existing foreign key if it exists
  ALTER TABLE public.call_recordings DROP CONSTRAINT IF EXISTS call_recordings_call_attempt_id_fkey;
  
  -- Add the foreign key constraint
  ALTER TABLE public.call_recordings
    ADD CONSTRAINT call_recordings_call_attempt_id_fkey
    FOREIGN KEY (call_attempt_id)
    REFERENCES public.call_attempts(id)
    ON DELETE CASCADE;
END $$;

-- Grant permissions
GRANT SELECT ON public.call_recordings TO authenticated;

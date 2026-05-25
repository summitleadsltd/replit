-- Create recordings table if it doesn't exist
-- This ensures the recordings page has a table to query

DO $$
BEGIN
  -- Check if recordings table exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recordings') THEN
    CREATE TABLE public.recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_attempt_id UUID REFERENCES public.call_attempts(id) ON DELETE CASCADE,
      telnyx_recording_id TEXT,
      recording_url TEXT,
      duration_seconds INT,
      format TEXT DEFAULT 'mp3',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
    
    -- Create RLS policy
    CREATE POLICY "View recordings"
      ON public.recordings
      FOR SELECT
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'team_leader'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.call_attempts ca
          WHERE ca.id = recordings.call_attempt_id
            AND ca.agent_id = auth.uid()
        )
      );
    
    -- Create indexes
    CREATE INDEX idx_recordings_call_attempt_id ON public.recordings(call_attempt_id);
    CREATE INDEX idx_recordings_created_at ON public.recordings(created_at DESC);
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.recordings TO authenticated;

-- Check for any tables with recording in the name
-- This will help identify the correct table to query

DO $$
DECLARE
  tbl_name text;
BEGIN
  RAISE NOTICE 'Checking for tables with recording in the name...';
  
  FOR tbl_name IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name ILIKE '%recording%'
  LOOP
    RAISE NOTICE 'Found table: %', tbl_name;
  END LOOP;
  
  -- If no tables found, create a simple recordings table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name ILIKE '%recording%'
  ) THEN
    RAISE NOTICE 'No recording tables found, creating recordings table';
    CREATE TABLE public.recordings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      call_attempt_id UUID REFERENCES public.call_attempts(id) ON DELETE CASCADE,
      telnyx_recording_id TEXT,
      recording_url TEXT,
      duration_seconds INT,
      format TEXT DEFAULT 'mp3',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "View recordings"
      ON public.recordings
      FOR SELECT
      TO authenticated
      USING (true);
    
    GRANT SELECT ON public.recordings TO authenticated;
    RAISE NOTICE 'Created recordings table';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.call_attempts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.call_attempts ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "View call_attempts" ON public.call_attempts';
    EXECUTE $policy$
      CREATE POLICY "View call_attempts"
      ON public.call_attempts
      FOR SELECT
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'team_leader'::app_role)
        OR agent_id = auth.uid()
      )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Insert own call_attempts" ON public.call_attempts';
    EXECUTE $policy$
      CREATE POLICY "Insert own call_attempts"
      ON public.call_attempts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role)
        OR agent_id = auth.uid()
      )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Update own call_attempts" ON public.call_attempts';
    EXECUTE $policy$
      CREATE POLICY "Update own call_attempts"
      ON public.call_attempts
      FOR UPDATE
      TO authenticated
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR agent_id = auth.uid()
      )
      WITH CHECK (
        has_role(auth.uid(), 'admin'::app_role)
        OR agent_id = auth.uid()
      )
    $policy$;
  END IF;

  IF to_regclass('public.call_recordings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "View call_recordings" ON public.call_recordings';
    EXECUTE $policy$
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
      )
    $policy$;
  END IF;

  IF to_regclass('public.call_transcripts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.ai_summaries') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY';
  END IF;

  IF to_regclass('public.agent_telephony_credentials') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.agent_telephony_credentials ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Admins manage agent telephony credentials" ON public.agent_telephony_credentials';
    EXECUTE $policy$
      CREATE POLICY "Admins manage agent telephony credentials"
      ON public.agent_telephony_credentials
      FOR ALL
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role))
    $policy$;
  END IF;
END $$;

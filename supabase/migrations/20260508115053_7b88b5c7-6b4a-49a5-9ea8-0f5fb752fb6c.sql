DO $$
BEGIN
  IF to_regclass('public.campaign_lead_availability') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.campaign_lead_availability SET (security_invoker = true)';
  END IF;
END $$;

-- Fix: operator precedence bug in assign_daily_leads
-- The OR condition for language/callback_spanish was not properly parenthesized,
-- causing all contacts matching c.language = p_language to be selected regardless
-- of company, assignment status, or lead_status filters.

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

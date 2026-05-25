-- Create campaign_lead_availability view for lead assignment page
-- This view shows lead counts per campaign for the lead assignment UI

CREATE OR REPLACE VIEW public.campaign_lead_availability AS
SELECT 
  c.id AS campaign_id,
  COUNT(cc.id) AS total_leads,
  COUNT(CASE WHEN cc.dial_status = 'pending' AND cc.assigned_agent_id IS NULL THEN 1 END) AS available_leads,
  COUNT(CASE WHEN cc.assigned_agent_id IS NOT NULL AND cc.assigned_date = CURRENT_DATE THEN 1 END) AS assigned_leads
FROM public.campaigns c
LEFT JOIN public.campaign_contacts cc ON cc.campaign_id = c.id
GROUP BY c.id;

-- Grant access to authenticated users
GRANT SELECT ON public.campaign_lead_availability TO authenticated;

-- Set security invoker for RLS to work correctly
ALTER VIEW public.campaign_lead_availability SET (security_invoker = true);

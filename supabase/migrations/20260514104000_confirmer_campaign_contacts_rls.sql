-- Add confirmer role to campaign_contacts RLS policy
-- Confirmers need to view leads assigned to them for Daily Lead Queue

-- Drop and recreate the campaign_contacts visibility policy to include confirmer
DROP POLICY IF EXISTS "View campaign_contacts" ON public.campaign_contacts;

CREATE POLICY "View campaign_contacts" ON public.campaign_contacts
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_contacts.campaign_id AND is_same_company(c.company_id))
      AND (
        has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'confirmer'::app_role)
        OR is_agent_on_campaign(auth.uid(), campaign_id)
        OR assigned_agent_id = auth.uid()
      )
    )
  );

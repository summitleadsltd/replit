-- Add confirmer role to campaign_agents RLS policy
-- Confirmers need to see campaign assignments when managing appointments

DO $$
BEGIN
  -- Drop old policy if it exists
  DROP POLICY IF EXISTS "Managers and TLs can view campaign_agents" ON public.campaign_agents;

  -- Drop new policy if it already exists (for re-running)
  DROP POLICY IF EXISTS "Managers, TLs, and Confirmers can view campaign_agents" ON public.campaign_agents;

  -- Create the updated policy
  CREATE POLICY "Managers, TLs, and Confirmers can view campaign_agents"
  ON public.campaign_agents
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'team_leader'::app_role)
    OR has_role(auth.uid(), 'confirmer'::app_role)
  );
END $$;

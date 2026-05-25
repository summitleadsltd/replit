-- Add confirmer role to callbacks RLS policy
-- Confirmers need to view callbacks assigned to them for Daily Lead Queue

-- Drop and recreate the callbacks visibility policy to include confirmer
DROP POLICY IF EXISTS "View callbacks" ON public.callbacks;

CREATE POLICY "View callbacks" ON public.callbacks
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      (campaign_id IS NULL OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = callbacks.campaign_id AND is_same_company(c.company_id)))
      AND (
        has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'confirmer'::app_role)
        OR agent_id = auth.uid()
      )
    )
  );

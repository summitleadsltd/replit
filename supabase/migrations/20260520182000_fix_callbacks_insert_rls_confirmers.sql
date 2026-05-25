-- Fix callbacks INSERT RLS to allow all authenticated users (admin, manager, agent, confirmer)
-- Any user should be able to book callbacks

-- Drop existing policies (including the one we're about to recreate)
DROP POLICY IF EXISTS "Agents can insert callbacks" ON public.callbacks;
DROP POLICY IF EXISTS "Agents and confirmers can insert callbacks" ON public.callbacks;
DROP POLICY IF EXISTS "Users can insert callbacks" ON public.callbacks;

-- Create a new policy that allows all authenticated users
CREATE POLICY "Users can insert callbacks" ON public.callbacks
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = agent_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'confirmer'::app_role)
      OR is_agent_on_campaign(auth.uid(), campaign_id)
      OR campaign_id IS NULL
    )
  );

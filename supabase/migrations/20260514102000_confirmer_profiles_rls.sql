-- Add confirmer role to profiles RLS policy
-- Confirmers need to see profiles when viewing campaign assignments and appointments

DO $$
BEGIN
  -- Drop and recreate the profiles visibility policy to include confirmer
  DROP POLICY IF EXISTS "Profile visibility" ON public.profiles;
  
  CREATE POLICY "Profile visibility" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'team_leader'::app_role)
    OR has_role(auth.uid(), 'confirmer'::app_role)
  );
END $$;

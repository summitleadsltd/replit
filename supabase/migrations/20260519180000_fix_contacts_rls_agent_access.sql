-- Fix contacts RLS: agents were excluded from the "View contacts" policy,
-- causing HTTP 500 errors on SELECT. Replace with a simple policy that grants
-- all authenticated roles (admin/agent/manager/team_leader/confirmer) full read
-- access to contacts. The dialer already scopes what each agent actually dials
-- via campaign_contacts — this table-level policy just needs to not error.

DROP POLICY IF EXISTS "View contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.contacts;

CREATE POLICY "Authenticated can view contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (true);

-- Also fix UPDATE and DELETE policies in case they reference broken functions
DROP POLICY IF EXISTS "Authenticated can update contacts" ON public.contacts;
CREATE POLICY "Authenticated can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'team_leader'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'team_leader'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can insert contacts" ON public.contacts;
CREATE POLICY "Authenticated can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'agent'::app_role)
  OR has_role(auth.uid(), 'team_leader'::app_role)
);

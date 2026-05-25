-- Create bulk_assign_leads and bulk_unassign_leads RPC functions
-- These functions are used by the LeadAssignment page to distribute leads to agents

CREATE OR REPLACE FUNCTION public.bulk_assign_leads(
  p_campaign_id UUID,
  p_agent_id UUID,
  p_quantity INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_count INT := 0;
BEGIN
  -- Update campaign_contacts to assign leads to the agent
  WITH leads_to_assign AS (
    SELECT id
    FROM public.campaign_contacts
    WHERE 
      campaign_id = p_campaign_id
      AND (assigned_agent_id IS NULL OR assigned_agent_id = p_agent_id)
      AND dial_status = 'pending'
    ORDER BY 
      priority_score DESC NULLS LAST,
      created_at ASC
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.campaign_contacts
  SET 
    assigned_agent_id = p_agent_id,
    assigned_date = CURRENT_DATE,
    dial_status = 'pending',
    assignment_status = 'assigned'
  WHERE id IN (SELECT id FROM leads_to_assign);
  
  -- Count how many were assigned
  GET DIAGNOSTICS v_assigned_count = ROW_COUNT;
  
  RETURN v_assigned_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in bulk_assign_leads: %', SQLERRM;
    RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_unassign_leads(
  p_campaign_id UUID,
  p_agent_id UUID,
  p_quantity INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unassigned_count INT := 0;
  v_lead_ids UUID[];
BEGIN
  -- Get the IDs of leads to unassign
  SELECT ARRAY_AGG(id)
  INTO v_lead_ids
  FROM public.campaign_contacts
  WHERE 
    campaign_id = p_campaign_id
    AND assigned_agent_id = p_agent_id
    AND assigned_date = CURRENT_DATE
  LIMIT p_quantity;
  
  -- Update the selected leads
  IF v_lead_ids IS NOT NULL AND array_length(v_lead_ids, 1) > 0 THEN
    UPDATE public.campaign_contacts
    SET 
      assigned_agent_id = NULL,
      assigned_date = NULL,
      assignment_status = 'unassigned'
    WHERE id = ANY(v_lead_ids);
    
    v_unassigned_count := array_length(v_lead_ids, 1);
  END IF;
  
  RETURN v_unassigned_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in bulk_unassign_leads: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.bulk_assign_leads TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_unassign_leads TO authenticated;

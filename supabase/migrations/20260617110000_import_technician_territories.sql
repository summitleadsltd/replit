-- Import Technician Territories
-- Generated from Technician_Territory_ZipCodes.xlsx
-- Total records: 293
-- This migration imports the initial territory data
-- Note: Technician IDs will be matched by name after technicians are created
-- This is a placeholder migration - actual data import will be done via admin interface

-- Create a temporary function to help with territory assignment
CREATE OR REPLACE FUNCTION assign_territories_by_name()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tech_id uuid;
BEGIN
  -- This function will be called after technicians are created
  -- For now, we'll create the structure without data
  RAISE NOTICE 'Territory assignment function created';
END;
$$;

-- The actual territory data will be imported via the admin interface
-- once technicians have been created with their actual UUIDs

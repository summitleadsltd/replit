/**
 * CSV export utility for filtered leads on the Contacts page.
 * - Pure functions for testability
 * - RFC 4180 compliant escaping (shared with export-queue-csv.ts)
 * - UTF-8 with BOM for Excel compatibility
 * - All timestamps in ET (America/New_York)
 * - Exports the FULL filtered result set, not just the current page
 */
import { supabase } from "@/integrations/supabase/client";
import { buildCsv, downloadCsv, escapeCsvValue } from "@/lib/export-queue-csv";
import { appToday, formatESTShort } from "@/lib/timezone";

export interface LeadExportRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  phone_raw: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lead_status: string | null;
  disposition: string | null;
  locked_to_agent_id: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields (joined from other tables)
  attempts?: number;
  last_called_at?: string | null;
  assigned_agent_name?: string | null;
}

/** CSV column definition with header label and key accessor */
export const LEADS_CSV_COLUMNS: { key: keyof LeadExportRow; label: string }[] = [
  { key: "id", label: "id" },
  { key: "first_name", label: "first_name" },
  { key: "last_name", label: "last_name" },
  { key: "phone_e164", label: "phone" },
  { key: "email", label: "email" },
  { key: "company", label: "company" },
  { key: "title", label: "title" },
  { key: "city", label: "city" },
  { key: "state", label: "state" },
  { key: "zip", label: "zip" },
  { key: "lead_status", label: "lead_status" },
  { key: "disposition", label: "disposition" },
  { key: "attempts", label: "attempts" },
  { key: "assigned_agent_name", label: "assigned_agent" },
  { key: "last_called_at", label: "last_called_at" },
  { key: "created_at", label: "created_at" },
  { key: "updated_at", label: "updated_at" },
];

/**
 * Build CSV content from filtered leads.
 * - Includes UTF-8 BOM for Excel compatibility
 * - Preserves exact order of input array
 * - Formats timestamps in Eastern Time
 */
export function buildLeadsCsv(leads: LeadExportRow[]): string {
  return buildCsv(LEADS_CSV_COLUMNS, leads, (value, key) => {
    // Format timestamp columns in Eastern Time
    if ((key === "last_called_at" || key === "created_at" || key === "updated_at") && value) {
      return formatESTShort(value as string);
    }
    return value;
  });
}

/**
 * Generate filename for leads export.
 * Format: leads_<status>_YYYY-MM-DD.csv or leads_export_YYYY-MM-DD.csv
 */
export function generateLeadsFilename(statusFilter: string): string {
  const dateStr = appToday(); // Eastern calendar date (YYYY-MM-DD)
  const statusPart = statusFilter && statusFilter !== "all" ? `${statusFilter}_` : "";
  return `leads_${statusPart}${dateStr}.csv`;
}

/**
 * Fetch all leads matching the given filters (full result set, not paginated).
 * This runs a dedicated query that applies the same filters as the Contacts page
 * and fetches ALL matching rows via server-side pagination.
 * 
 * Respects RLS - only returns rows the user is permitted to see.
 */
export async function fetchFilteredLeadsForExport(options: {
  search?: string;
  statusFilter?: string;
  campaignFilter?: string;
  ownershipFilter?: string;
  orderBy?: { column: string; ascending: boolean };
}): Promise<LeadExportRow[]> {
  const { search, statusFilter, campaignFilter, ownershipFilter, orderBy } = options;

  // Build the base query
  let query = supabase
    .from("contacts")
    .select(`
      id,
      first_name,
      last_name,
      phone_e164,
      phone_raw,
      email,
      company,
      title,
      city,
      state,
      zip,
      lead_status,
      disposition,
      locked_to_agent_id,
      created_at,
      updated_at
    `);

  // Apply search filter
  if (search) {
    const filter = `first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_e164.ilike.%${search}%,email.ilike.%${search}%`;
    query = query.or(filter);
  }

  // Apply status filter
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("lead_status", statusFilter);
  }

  // Apply ownership filter
  if (ownershipFilter === "locked") {
    query = query.not("locked_to_agent_id", "is", null);
  } else if (ownershipFilter === "unlocked") {
    query = query.is("locked_to_agent_id", null);
  }

  // Apply campaign filter (requires a subquery to get contact IDs)
  let contactIds: string[] | null = null;
  if (campaignFilter && campaignFilter !== "all") {
    const { data: links } = await supabase
      .from("campaign_contacts")
      .select("contact_id")
      .eq("campaign_id", campaignFilter);
    contactIds = (links || []).map((l) => l.contact_id);
    if (contactIds.length === 0) {
      return []; // No contacts in this campaign
    }
    query = query.in("id", contactIds);
  }

  // Apply sort
  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
  } else {
    // Default sort: created_at desc (matches Contacts page default)
    query = query.order("created_at", { ascending: false });
  }

  // Fetch ALL matching rows with server-side pagination
  // Supabase/Postgres has a default row limit, so we paginate in batches
  const BATCH_SIZE = 1000;
  let allLeads: LeadExportRow[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + BATCH_SIZE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      throw new Error(`Failed to fetch leads for export: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allLeads = allLeads.concat(data as LeadExportRow[]);
    
    // If we got fewer rows than the batch size, we're done
    if (data.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      from += BATCH_SIZE;
    }
  }

  // Enrich with computed fields (attempts, last_called_at, assigned_agent_name)
  // Fetch in batches to avoid overwhelming the database
  const enrichedLeads = await enrichLeadsWithComputedFields(allLeads);

  return enrichedLeads;
}

/**
 * Enrich leads with computed fields from related tables.
 * - attempts: max attempts across all campaign_contacts for this contact
 * - last_called_at: most recent last_called_at across campaign_contacts
 * - assigned_agent_name: display_name from profiles for locked_to_agent_id
 */
async function enrichLeadsWithComputedFields(leads: LeadExportRow[]): Promise<LeadExportRow[]> {
  if (leads.length === 0) return leads;

  const contactIds = leads.map((l) => l.id);
  const agentIds = leads.map((l) => l.locked_to_agent_id).filter(Boolean) as string[];

  // Fetch campaign_contacts data for attempts and last_called_at
  const { data: campaignContacts } = await supabase
    .from("campaign_contacts")
    .select("contact_id, attempts, last_called_at")
    .in("contact_id", contactIds);

  // Fetch agent names
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", agentIds);

  // Build lookup maps
  const agentMap = new Map((profiles || []).map((p) => [p.user_id, p.display_name || "Agent"]));
  
  const contactOpsMap = new Map<string, { attempts: number; last_called_at: string | null }>();
  for (const cc of campaignContacts || []) {
    const existing = contactOpsMap.get(cc.contact_id) || { attempts: 0, last_called_at: null };
    contactOpsMap.set(cc.contact_id, {
      attempts: Math.max(existing.attempts, cc.attempts ?? 0),
      last_called_at: !existing.last_called_at || (cc.last_called_at && cc.last_called_at > existing.last_called_at)
        ? cc.last_called_at
        : existing.last_called_at,
    });
  }

  // Enrich each lead
  return leads.map((lead) => {
    const ops = contactOpsMap.get(lead.id);
    return {
      ...lead,
      attempts: ops?.attempts ?? 0,
      last_called_at: ops?.last_called_at ?? null,
      assigned_agent_name: lead.locked_to_agent_id ? agentMap.get(lead.locked_to_agent_id) ?? null : null,
    };
  });
}

/**
 * Export filtered leads to CSV and trigger browser download.
 * This is the main entry point for the Contacts page export button.
 */
export async function exportFilteredLeadsToCsv(options: {
  search?: string;
  statusFilter?: string;
  campaignFilter?: string;
  ownershipFilter?: string;
  orderBy?: { column: string; ascending: boolean };
}): Promise<void> {
  const leads = await fetchFilteredLeadsForExport(options);
  const csvContent = buildLeadsCsv(leads);
  const filename = generateLeadsFilename(options.statusFilter || "all");
  downloadCsv(filename, csvContent);
}

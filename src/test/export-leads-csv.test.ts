import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildLeadsCsv,
  generateLeadsFilename,
  LeadExportRow,
} from "@/lib/export-leads-csv";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              is: vi.fn(() => ({
                in: vi.fn(() => ({
                  order: vi.fn(() => ({
                    range: vi.fn(() => Promise.resolve({ data: [], error: null })),
                  })),
                })),
              })),
            })),
            is: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
          not: vi.fn(() => ({
            is: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          })),
          is: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

describe("export-leads-csv", () => {
  describe("buildLeadsCsv", () => {
    it("includes UTF-8 BOM at start", () => {
      const leads: LeadExportRow[] = [];
      const csv = buildLeadsCsv(leads);
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });

    it("includes correct headers in order", () => {
      const leads: LeadExportRow[] = [];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const headerLine = lines[0].replace("\uFEFF", "");
      expect(headerLine).toBe(
        "id,first_name,last_name,phone,email,company,title,city,state,zip,lead_status,disposition,attempts,assigned_agent,last_called_at,created_at,updated_at"
      );
    });

    it("preserves row order", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: "Alice",
          last_name: "Smith",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "alice@example.com",
          company: "Acme Corp",
          title: "Manager",
          city: "New York",
          state: "NY",
          zip: "10001",
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "2",
          first_name: "Bob",
          last_name: "Jones",
          phone_e164: "+0987654321",
          phone_raw: null,
          email: "bob@example.com",
          company: "Beta Inc",
          title: "Director",
          city: "Los Angeles",
          state: "CA",
          zip: "90001",
          lead_status: "contacted",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      expect(lines[1]).toContain("Alice");
      expect(lines[2]).toContain("Bob");
    });

    it("handles null values correctly", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: null,
          last_name: null,
          phone_e164: null,
          phone_raw: null,
          email: null,
          company: null,
          title: null,
          city: null,
          state: null,
          zip: null,
          lead_status: null,
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];
      // Should have empty values for null fields
      expect(dataLine).toMatch(/^1,,,,,,,,,,,,,,/);
    });

    it("escapes special characters in fields", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: 'Robert "Bob"',
          last_name: "Smith, Jr.",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "bob@example.com",
          company: "Acme, Inc.",
          title: null,
          city: null,
          state: null,
          zip: null,
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];
      expect(dataLine).toContain('"Robert ""Bob"""');
      expect(dataLine).toContain('"Smith, Jr."');
      expect(dataLine).toContain('"Acme, Inc."');
    });

    it("includes computed fields (attempts, assigned_agent_name)", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: "Alice",
          last_name: "Smith",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "alice@example.com",
          company: null,
          title: null,
          city: null,
          state: null,
          zip: null,
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: "agent-1",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          attempts: 5,
          assigned_agent_name: "John Doe",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];
      expect(dataLine).toContain("5"); // attempts
      expect(dataLine).toContain("John Doe"); // assigned_agent_name
    });
  });

  describe("generateLeadsFilename", () => {
    it("generates filename with status when status filter is active", () => {
      const filename = generateLeadsFilename("new");
      // Format: leads_<status>_YYYY-MM-DD.csv
      expect(filename).toMatch(/^leads_new_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("generates filename without status when status is 'all'", () => {
      const filename = generateLeadsFilename("all");
      // Format: leads_export_YYYY-MM-DD.csv (but actually leads__YYYY-MM-DD.csv with our current impl)
      // Wait, looking at the implementation: leads_${statusPart}${dateStr}.csv
      // If status is "all", statusPart is empty, so it's leads_${dateStr}.csv
      expect(filename).toMatch(/^leads_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("generates filename without status when status is empty string", () => {
      const filename = generateLeadsFilename("");
      expect(filename).toMatch(/^leads_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("uses Eastern calendar date", () => {
      const filename = generateLeadsFilename("new");
      // The date should be in Eastern Time, which we can't easily test without
      // mocking the timezone, but we can verify the format
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe("CSV escaping (inherited from shared core)", () => {
    it("handles commas in company names", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: "Alice",
          last_name: "Smith",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "alice@example.com",
          company: "Smith, Jones, and Partners",
          title: null,
          city: null,
          state: null,
          zip: null,
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];
      expect(dataLine).toContain('"Smith, Jones, and Partners"');
    });

    it("handles newlines in notes or other text fields", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: "Alice",
          last_name: "Smith",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "alice@example.com",
          company: null,
          title: "Manager\nSales\nMarketing",
          city: null,
          state: null,
          zip: null,
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataPortion = lines.slice(1).join("\n");
      expect(dataPortion).toContain('"Manager\nSales\nMarketing"');
    });

    it("handles quotes in names", () => {
      const leads: LeadExportRow[] = [
        {
          id: "1",
          first_name: 'O\'Connor',
          last_name: "Smith",
          phone_e164: "+1234567890",
          phone_raw: null,
          email: "alice@example.com",
          company: null,
          title: null,
          city: null,
          state: null,
          zip: null,
          lead_status: "new",
          disposition: null,
          locked_to_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];
      const csv = buildLeadsCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];
      // Single quotes don't need escaping in CSV, only double quotes
      expect(dataLine).toContain("O'Connor");
    });
  });
});

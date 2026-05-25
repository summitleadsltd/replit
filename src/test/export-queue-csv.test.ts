import { describe, it, expect } from "vitest";
import {
  buildQueueCsv,
  buildCsv,
  escapeCsvValue,
  generateQueueFilename,
  QueueExportLead,
} from "@/lib/export-queue-csv";

describe("export-queue-csv", () => {
  describe("escapeCsvValue", () => {
    it("returns empty string for null/undefined", () => {
      expect(escapeCsvValue(null)).toBe("");
      expect(escapeCsvValue(undefined)).toBe("");
    });

    it("returns string value as-is when no special chars", () => {
      expect(escapeCsvValue("John")).toBe("John");
      expect(escapeCsvValue("Doe")).toBe("Doe");
      expect(escapeCsvValue("12345")).toBe("12345");
    });

    it("wraps in quotes when value contains comma", () => {
      expect(escapeCsvValue("Smith, Jr.")).toBe('"Smith, Jr."');
    });

    it("wraps in quotes when value contains quote", () => {
      expect(escapeCsvValue('Robert "Bob"')).toBe('"Robert ""Bob"""');
    });

    it("wraps in quotes when value contains newline", () => {
      expect(escapeCsvValue("Line1\nLine2")).toBe('"Line1\nLine2"');
    });

    it("wraps in quotes when value contains carriage return", () => {
      expect(escapeCsvValue("Line1\rLine2")).toBe('"Line1\rLine2"');
    });

    it("handles complex combination of comma and quote", () => {
      expect(escapeCsvValue('Smith, "Bob"')).toBe('"Smith, ""Bob"""');
    });

    it("converts numbers to strings", () => {
      expect(escapeCsvValue(42)).toBe("42");
      expect(escapeCsvValue(3.14)).toBe("3.14");
    });
  });

  describe("buildQueueCsv", () => {
    it("includes UTF-8 BOM at start", () => {
      const leads: QueueExportLead[] = [];
      const csv = buildQueueCsv(leads);
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });

    it("includes correct headers in order", () => {
      const leads: QueueExportLead[] = [];
      const csv = buildQueueCsv(leads);
      const lines = csv.trim().split("\n");
      const headerLine = lines[0].replace("\uFEFF", ""); // Remove BOM for comparison
      expect(headerLine).toBe(
        "dial_order,lead_id,first_name,last_name,phone,secondary_phone,email,company,city,state,zip,source,disposition,priority_score,assigned_to,last_contacted_at,notes"
      );
    });

    it("preserves ordering with dial_order column starting at 1", () => {
      const leads: QueueExportLead[] = [
        {
          lead_id: "lead-1",
          first_name: "Alice",
          last_name: "Smith",
          phone: "+1234567890",
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: 100,
          assigned_to: "user-1",
          last_contacted_at: null,
          notes: null,
        },
        {
          lead_id: "lead-2",
          first_name: "Bob",
          last_name: "Jones",
          phone: "+0987654321",
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: 90,
          assigned_to: "user-1",
          last_contacted_at: null,
          notes: null,
        },
        {
          lead_id: "lead-3",
          first_name: "Carol",
          last_name: "White",
          phone: "+1122334455",
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: 80,
          assigned_to: "user-1",
          last_contacted_at: null,
          notes: null,
        },
      ];

      const csv = buildQueueCsv(leads);
      const lines = csv.trim().split("\n");

      // Skip header (line 0), check data lines have correct dial_order
      expect(lines[1]).toMatch(/^1,/);
      expect(lines[2]).toMatch(/^2,/);
      expect(lines[3]).toMatch(/^3,/);
    });

    it("correctly escapes name with comma and quote", () => {
      const leads: QueueExportLead[] = [
        {
          lead_id: "lead-1",
          first_name: 'Robert "Bob"',
          last_name: "Smith, Jr.",
          phone: "+1234567890",
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: 100,
          assigned_to: "user-1",
          last_contacted_at: null,
          notes: null,
        },
      ];

      const csv = buildQueueCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];

      // Check that first_name is escaped: "Robert ""Bob"""
      expect(dataLine).toContain('"Robert ""Bob"""');
      // Check that last_name is escaped: "Smith, Jr."
      expect(dataLine).toContain('"Smith, Jr."');
    });

    it("handles leads with null values", () => {
      const leads: QueueExportLead[] = [
        {
          lead_id: "lead-1",
          first_name: null,
          last_name: null,
          phone: null,
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: null,
          assigned_to: null,
          last_contacted_at: null,
          notes: null,
        },
      ];

      const csv = buildQueueCsv(leads);
      const lines = csv.trim().split("\n");
      const dataLine = lines[1];

      // Should be: 1,lead-1,,,,,,,,,,,,,,,
      expect(dataLine).toBe("1,lead-1,,,,,,,,,,,,,,,");
    });

    it("handles notes with newlines", () => {
      const leads: QueueExportLead[] = [
        {
          lead_id: "lead-1",
          first_name: "Alice",
          last_name: "Smith",
          phone: "+1234567890",
          secondary_phone: null,
          email: null,
          company: null,
          city: null,
          state: null,
          zip: null,
          source: null,
          disposition: null,
          priority_score: 100,
          assigned_to: "user-1",
          last_contacted_at: null,
          notes: "First line\nSecond line\nThird line",
        },
      ];

      const csv = buildQueueCsv(leads);
      const lines = csv.trim().split("\n");

      // CSV with newlines in a field should have the field quoted
      // The data should be on a single logical line (line 1 in our array)
      // But split on \n will show it spans multiple lines due to the quoted newline
      const dataPortion = lines.slice(1).join("\n");
      expect(dataPortion).toContain('"First line\nSecond line\nThird line"');
    });
  });

  describe("generateQueueFilename", () => {
    it("generates correct filename format", () => {
      const date = new Date("2026-05-20");
      const filename = generateQueueFilename("john_doe", date);
      expect(filename).toBe("daily-queue_john_doe_2026-05-20.csv");
    });

    it("sanitizes special characters in handle", () => {
      const date = new Date("2026-05-20");
      const filename = generateQueueFilename("john@doe.com", date);
      expect(filename).toBe("daily-queue_john_doe_com_2026-05-20.csv");
    });

    it("uses current date by default", () => {
      const filename = generateQueueFilename("agent");
      const today = new Date().toISOString().slice(0, 10);
      expect(filename).toBe(`daily-queue_agent_${today}.csv`);
    });

    it("preserves underscores and hyphens", () => {
      const date = new Date("2026-05-20");
      const filename = generateQueueFilename("agent_123-test", date);
      expect(filename).toBe("daily-queue_agent_123-test_2026-05-20.csv");
    });
  });

  describe("buildCsv (shared core)", () => {
    it("includes UTF-8 BOM at start", () => {
      const columns = [{ key: "name" as const, label: "Name" }];
      const rows = [{ name: "Alice" }];
      const csv = buildCsv(columns, rows);
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });

    it("includes correct headers in order", () => {
      const columns = [
        { key: "id" as const, label: "ID" },
        { key: "name" as const, label: "Name" },
        { key: "email" as const, label: "Email" },
      ];
      const rows = [];
      const csv = buildCsv(columns, rows);
      const lines = csv.trim().split("\n");
      const headerLine = lines[0].replace("\uFEFF", "");
      expect(headerLine).toBe("ID,Name,Email");
    });

    it("preserves row order", () => {
      const columns = [{ key: "name" as const, label: "Name" }];
      const rows = [
        { name: "Alice" },
        { name: "Bob" },
        { name: "Carol" },
      ];
      const csv = buildCsv(columns, rows);
      const lines = csv.trim().split("\n");
      expect(lines[1]).toBe("Alice");
      expect(lines[2]).toBe("Bob");
      expect(lines[3]).toBe("Carol");
    });

    it("applies value transformer when provided", () => {
      const columns = [{ key: "value" as const, label: "Value" }];
      const rows = [{ value: "test" }];
      const transformer = (v: unknown) => (typeof v === "string" ? v.toUpperCase() : v);
      const csv = buildCsv(columns, rows, transformer);
      const lines = csv.trim().split("\n");
      expect(lines[1]).toBe("TEST");
    });

    it("handles null values correctly", () => {
      const columns = [
        { key: "name" as const, label: "Name" },
        { key: "email" as const, label: "Email" },
      ];
      const rows = [{ name: "Alice", email: null }];
      const csv = buildCsv(columns, rows);
      const lines = csv.trim().split("\n");
      expect(lines[1]).toBe("Alice,");
    });

    it("escapes special characters using escapeCsvValue", () => {
      const columns = [{ key: "value" as const, label: "Value" }];
      const rows = [{ value: 'Smith, "Bob"' }];
      const csv = buildCsv(columns, rows);
      const lines = csv.trim().split("\n");
      expect(lines[1]).toBe('"Smith, ""Bob"""');
    });

    it("returns headers only when rows array is empty", () => {
      const columns = [{ key: "name" as const, label: "Name" }];
      const rows: any[] = [];
      const csv = buildCsv(columns, rows);
      const lines = csv.trim().split("\n");
      expect(lines.length).toBe(1);
      expect(lines[0].replace("\uFEFF", "")).toBe("Name");
    });

    it("handles undefined rows array", () => {
      const columns = [{ key: "name" as const, label: "Name" }];
      const csv = buildCsv(columns, undefined as any);
      const lines = csv.trim().split("\n");
      expect(lines.length).toBe(1);
      expect(lines[0].replace("\uFEFF", "")).toBe("Name");
    });
  });
});

/**
 * CSV export utility for daily lead queues.
 * - Pure functions for testability
 * - RFC 4180 compliant escaping
 * - UTF-8 with BOM for Excel compatibility
 * - All timestamps in ET (America/New_York)
 */
import { appToday, formatESTShort } from "@/lib/timezone";

export interface QueueExportLead {
  lead_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source: string | null;
  disposition: string | null;
  priority_score: number | null;
  assigned_to: string | null;
  last_contacted_at: string | null; // stored as UTC ISO; rendered as ET in CSV
  notes: string | null;
}

/** CSV column definition with header label and key accessor */
export const QUEUE_CSV_COLUMNS: { key: keyof QueueExportLead; label: string }[] = [
  { key: "lead_id", label: "lead_id" },
  { key: "first_name", label: "first_name" },
  { key: "last_name", label: "last_name" },
  { key: "phone", label: "phone" },
  { key: "secondary_phone", label: "secondary_phone" },
  { key: "email", label: "email" },
  { key: "company", label: "company" },
  { key: "city", label: "city" },
  { key: "state", label: "state" },
  { key: "zip", label: "zip" },
  { key: "source", label: "source" },
  { key: "disposition", label: "disposition" },
  { key: "priority_score", label: "priority_score" },
  { key: "assigned_to", label: "assigned_to" },
  { key: "last_contacted_at", label: "last_contacted_at" },
  { key: "notes", label: "notes" },
];

/**
 * Escape a CSV value per RFC 4180:
 * - Wrap in quotes if contains comma, quote, or newline
 * - Double existing quotes inside quoted fields
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = typeof val === "string" ? val : String(val);
  // Check if we need to quote
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generic CSV builder.
 * - Takes column definitions and row data
 * - Includes UTF-8 BOM for Excel compatibility
 * - Preserves exact order of input array
 * - Optional value transformer for custom formatting (e.g., timezone conversion)
 */
export function buildCsv<T>(
  columns: { key: keyof T; label: string }[],
  rows: T[],
  valueTransformer?: (value: unknown, columnKey: keyof T, row: T) => unknown,
): string {
  if (!rows || rows.length === 0) {
    const headers = columns.map((c) => c.label);
    return "\uFEFF" + headers.join(",") + "\n";
  }

  const headers = columns.map((c) => c.label);
  const headerLine = headers.map(escapeCsvValue).join(",");

  const bodyLines = rows.map((row) => {
    const values = columns.map((col) => {
      const v = row[col.key];
      return valueTransformer ? valueTransformer(v, col.key, row) : v;
    });
    return values.map(escapeCsvValue).join(",");
  });

  return "\uFEFF" + [headerLine, ...bodyLines].join("\n") + "\n";
}

/**
 * Build CSV content from queue leads.
 * - Adds dial_order column as first column (1-based index)
 * - Includes UTF-8 BOM for Excel compatibility
 * - Preserves exact order of input array
 */
export function buildQueueCsv(leads: QueueExportLead[]): string {
  if (!leads || leads.length === 0) {
    const headers = ["dial_order", ...QUEUE_CSV_COLUMNS.map((c) => c.label)];
    return "\uFEFF" + headers.join(",") + "\n";
  }

  const headers = ["dial_order", ...QUEUE_CSV_COLUMNS.map((c) => c.label)];
  const headerLine = headers.map(escapeCsvValue).join(",");

  const bodyLines = leads.map((lead, index) => {
    const dialOrder = (index + 1).toString();
    const values = [
      dialOrder,
      ...QUEUE_CSV_COLUMNS.map((col) => {
        const v = lead[col.key];
        // Render timestamp columns in Eastern Time
        if (col.key === "last_contacted_at" && v) return formatESTShort(v as string);
        return v;
      }),
    ];
    return values.map(escapeCsvValue).join(",");
  });

  return "\uFEFF" + [headerLine, ...bodyLines].join("\n") + "\n";
}

/**
 * Generate filename for queue export.
 * Format: daily-queue_{assignedUserHandle}_{YYYY-MM-DD}.csv
 */
export function generateQueueFilename(
  assignedUserHandle: string,
  overrideDate?: Date,
): string {
  const dateStr = overrideDate
    ? overrideDate.toISOString().slice(0, 10)
    : appToday(); // Eastern calendar date (YYYY-MM-DD)
  // Sanitize handle: remove special chars that could break filenames
  const safeHandle = assignedUserHandle.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `daily-queue_${safeHandle}_${dateStr}.csv`;
}

/**
 * Trigger browser download of CSV content.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Simulated connector state for the prototype.
 *
 * The production system ingests from six sources; this POC runs on seeded data.
 * These values are static and illustrative — they exist so the intended
 * architecture is legible to anyone reviewing the prototype. Nothing here
 * touches a live system.
 */

export type ConnectorHealth = "Healthy" | "Degraded" | "Stale";

export interface ConnectorRow {
  name: string;
  method: string;
  cadence: string;
  /** Minutes ago, rendered relative at display time so it never looks frozen. */
  lastSyncMinutesAgo: number;
  recordsLastRun: number;
  health: ConnectorHealth;
  note: string;
}

export const CONNECTORS: ConnectorRow[] = [
  {
    name: "Notion CRM",
    method: "Notion API · database query",
    cadence: "Every 15 minutes",
    lastSyncMinutesAgo: 8,
    recordsLastRun: 20,
    health: "Healthy",
    note: "Companies, contacts and owner assignment.",
  },
  {
    name: "Excel",
    method: "SharePoint file watcher · sheet parse",
    cadence: "Hourly",
    lastSyncMinutesAgo: 42,
    recordsLastRun: 49,
    health: "Healthy",
    note: "Opportunity sizing and legacy pipeline sheets.",
  },
  {
    name: "Email / IMAP",
    method: "IMAP poll · thread + header extraction",
    cadence: "Every 10 minutes",
    lastSyncMinutesAgo: 4,
    recordsLastRun: 63,
    health: "Healthy",
    note: "Email touchpoints arrive without a star rating by design.",
  },
  {
    name: "Granola call notes",
    method: "Granola webhook · transcript summary",
    cadence: "On call completion",
    lastSyncMinutesAgo: 176,
    recordsLastRun: 11,
    health: "Degraded",
    note: "2 transcripts failed speaker attribution and were queued for retry.",
  },
  {
    name: "Collateral documents",
    method: "Drive sync · PDF/DOCX text extraction",
    cadence: "Nightly",
    lastSyncMinutesAgo: 1_140,
    recordsLastRun: 34,
    health: "Stale",
    note: "Last successful pass was the overnight window; no run since.",
  },
  {
    name: "News feeds",
    method: "RSS + publisher APIs · entity matching",
    cadence: "Every 30 minutes",
    lastSyncMinutesAgo: 19,
    recordsLastRun: 12,
    health: "Healthy",
    note: "Matched against company names, then relevance-scored.",
  },
];

export function formatRelativeSync(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hours = Math.round(minutesAgo / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

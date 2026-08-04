import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Collateral store.
 *
 * What we can actually put in front of a client. Outreach drafts attach from
 * here rather than inventing a document that does not exist, and the account
 * page suggests by industry first, then falls back to the generic pieces.
 */

export interface CollateralItem {
  id: string;
  title: string;
  kind: string;
  industry: string | null;
  owner_unit: string;
  url: string;
  summary: string | null;
  updated_at: string;
}

export interface CollateralData {
  items: CollateralItem[];
  kinds: { kind: string; count: number }[];
  /** Anything not touched in six months is a liability in a pitch. */
  stale: CollateralItem[];
}

const STALE_DAYS = 180;

export async function getCollateral(): Promise<CollateralData> {
  const db = serverClient();
  const res = await db
    .from("collateral")
    .select("id,title,kind,industry,owner_unit,url,summary,updated_at")
    .order("kind")
    .order("title");
  if (res.error) throw new Error(res.error.message);

  const items = res.data ?? [];
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);

  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

  return {
    items,
    kinds: [...counts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    stale: items.filter((i) => new Date(i.updated_at).getTime() < cutoff),
  };
}

/** Industry match first, then the pieces that work for anyone. */
export async function suggestCollateral(
  industry: string | null,
  limit = 4,
): Promise<CollateralItem[]> {
  const db = serverClient();
  const res = await db
    .from("collateral")
    .select("id,title,kind,industry,owner_unit,url,summary,updated_at")
    .order("updated_at", { ascending: false });
  if (res.error) throw new Error(res.error.message);

  const items = res.data ?? [];
  const matched = industry ? items.filter((i) => i.industry === industry) : [];
  const generic = items.filter((i) => i.industry === null);
  const seen = new Set<string>();
  return [...matched, ...generic]
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .slice(0, limit);
}

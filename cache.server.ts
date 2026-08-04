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
 * Generation cache.
 *
 * Every model call in this app is written against facts that only change when
 * the scoring run changes. So the same account on the same run should never be
 * paid for twice: the cache key is built from the facts, not from the clock.
 */

/** djb2 — stable across processes, short enough to read in a key. */
export function hashFacts(...parts: (string | number | null | undefined)[]): string {
  const input = parts.map((p) => (p === null || p === undefined ? "" : String(p))).join("\u0001");
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface CachedResult<T> {
  value: T;
  cached: boolean;
  hits: number;
}

/**
 * Reads the cache, and only calls `generate` on a miss. A failed write is
 * swallowed: a cache is an optimisation, never a reason to fail a request.
 */
export async function cachedGeneration<T>(input: {
  key: string;
  kind: string;
  model: string;
  force?: boolean | undefined;
  generate: () => Promise<T>;
}): Promise<CachedResult<T>> {
  const db = serverClient();

  if (!input.force) {
    const hit = await db
      .from("generation_cache")
      .select("id,content,hits")
      .eq("cache_key", input.key)
      .maybeSingle();
    if (!hit.error && hit.data) {
      const hits = (hit.data.hits ?? 0) + 1;
      await db
        .from("generation_cache")
        .update({ hits, last_used_at: new Date().toISOString() })
        .eq("id", hit.data.id);
      return { value: hit.data.content as T, cached: true, hits };
    }
  }

  const value = await input.generate();

  await db.from("generation_cache").upsert(
    {
      cache_key: input.key,
      kind: input.kind,
      model: input.model,
      content: value as never,
      hits: 0,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );

  return { value, cached: false, hits: 0 };
}

export interface CacheStats {
  entries: number;
  hits: number;
  /** Model calls avoided — every hit after the first write is one we did not make. */
  calls_avoided: number;
  hit_rate: number | null;
  by_kind: { kind: string; entries: number; hits: number }[];
  recent: {
    cache_key: string;
    kind: string;
    model: string | null;
    hits: number;
    last_used_at: string;
  }[];
}

export async function getCacheStats(): Promise<CacheStats> {
  const db = serverClient();
  const res = await db
    .from("generation_cache")
    .select("cache_key,kind,model,hits,last_used_at")
    .order("last_used_at", { ascending: false })
    .limit(200);
  if (res.error) throw new Error(res.error.message);

  const rows = res.data ?? [];
  const hits = rows.reduce((sum, r) => sum + (r.hits ?? 0), 0);
  const byKind = new Map<string, { entries: number; hits: number }>();
  for (const r of rows) {
    const cur = byKind.get(r.kind) ?? { entries: 0, hits: 0 };
    cur.entries += 1;
    cur.hits += r.hits ?? 0;
    byKind.set(r.kind, cur);
  }

  const requests = rows.length + hits;
  return {
    entries: rows.length,
    hits,
    calls_avoided: hits,
    hit_rate: requests === 0 ? null : hits / requests,
    by_kind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.entries - a.entries),
    recent: rows.slice(0, 8).map((r) => ({
      cache_key: r.cache_key,
      kind: r.kind,
      model: r.model,
      hits: r.hits ?? 0,
      last_used_at: r.last_used_at,
    })),
  };
}

export async function clearGenerationCache(kind?: string): Promise<{ cleared: number }> {
  const db = serverClient();
  const query = db.from("generation_cache").delete();
  const res = await (kind ? query.eq("kind", kind) : query.neq("cache_key", "")).select("id");
  if (res.error) throw new Error(res.error.message);
  return { cleared: res.data?.length ?? 0 };
}

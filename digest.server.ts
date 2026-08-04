import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getDashboardData } from "./dashboard.server";
import { getNewsData } from "./news.server";

function serverClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Spoken-briefing tuning. Speech synthesis lands around 150 words per minute,
 * so ~225 words is roughly 90 seconds. The builder trims sections from the
 * bottom up (news first, then movements) until it fits.
 */
export const DIGEST_CONFIG = {
  targetSeconds: 90,
  wordsPerMinute: 150,
  maxPrioritised: 4,
  maxMovements: 3,
  maxNews: 3,
} as const;

const MAX_WORDS = Math.round((DIGEST_CONFIG.targetSeconds / 60) * DIGEST_CONFIG.wordsPerMinute);

export interface DigestParagraph {
  heading: string;
  text: string;
}

export interface DigestScript {
  run_date: string | null;
  generated_for: string;
  paragraphs: DigestParagraph[];
  /** Flat text handed to speechSynthesis. */
  spoken_text: string;
  word_count: number;
  estimated_seconds: number;
  trimmed: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** "2 days ago" style phrasing that reads naturally when spoken aloud. */
function spokenDays(days: number | null): string {
  if (days === null) return "with no touchpoint on record";
  if (days === 0) return "last touched today";
  if (days === 1) return "last touched yesterday";
  return `last touched ${days} days ago`;
}

export async function buildDigestScript(now = new Date()): Promise<DigestScript> {
  const db = serverClient();

  const [dashboard, news, history] = await Promise.all([
    getDashboardData(now),
    getNewsData(),
    db
      .from("state_history")
      .select("company_id,from_state,to_state,actor,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (history.error) throw new Error(history.error.message);

  const dateLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!dashboard.run_date) {
    const text = `Good morning. It's ${dateLabel}. There's no scoring run yet, so there is nothing to brief on. Run the scoring engine in Settings and the digest will be ready.`;
    return {
      run_date: null,
      generated_for: dateLabel,
      paragraphs: [{ heading: "No data yet", text }],
      spoken_text: text,
      word_count: countWords(text),
      estimated_seconds: Math.round((countWords(text) / DIGEST_CONFIG.wordsPerMinute) * 60),
      trimmed: false,
    };
  }

  // --- Opening -------------------------------------------------------------
  const opening = [
    `Good morning. It's ${dateLabel}.`,
    dashboard.pipeline.length > 0
      ? `${dashboard.pipeline.length} ${dashboard.pipeline.length === 1 ? "company is in pipeline and needs" : "companies are in pipeline and need"} your attention today.`
      : `Nothing is in pipeline today.`,
    dashboard.summary.moved_since_yesterday > 0
      ? `${dashboard.summary.moved_since_yesterday} changed state since the last run.`
      : `No state changes since the last run.`,
    `${news.stats.passed} news ${news.stats.passed === 1 ? "item" : "items"} passed the relevance filter.`,
  ].join(" ");

  // --- Prioritised companies, and why each one is on the list --------------
  const prioritised = dashboard.pipeline.slice(0, DIGEST_CONFIG.maxPrioritised);
  const prioritisedSentences = prioritised.map((row, index) => {
    const reasons: string[] = [];
    if (row.tier_label) reasons.push(`${row.tier_label} contact on record`);
    reasons.push(spokenDays(row.days_since_last_touchpoint));
    if (row.owner_crm) reasons.push(`owned by ${row.owner_crm}`);
    if (row.news_count > 0) {
      reasons.push(`${row.news_count} news ${row.news_count === 1 ? "item" : "items"} attached`);
    }
    if (row.icp_missing) reasons.push("ICP data incomplete, so the score is provisional");
    return `${index === 0 ? "Top of the list" : `Number ${row.rank ?? index + 1}`}: ${row.name}, scoring ${row.final_score.toFixed(0)} — ${reasons.join(", ")}.`;
  });

  const prioritisedText =
    prioritisedSentences.length > 0
      ? prioritisedSentences.join(" ")
      : "No prioritised companies today — nothing has both a top-six score and a touchpoint in the last week.";

  // --- What moved ----------------------------------------------------------
  const cutoff = now.getTime() - MS_PER_DAY;
  const nameById = new Map<string, string>();
  for (const row of [
    ...dashboard.pipeline,
    ...dashboard.opportunity,
    ...dashboard.keep_in_touch,
    ...dashboard.needs_review,
  ]) {
    nameById.set(row.company_id, row.name);
  }

  const movements = (history.data ?? [])
    .filter(
      (h) =>
        h.from_state !== null &&
        h.from_state !== h.to_state &&
        new Date(h.created_at).getTime() >= cutoff,
    )
    .slice(0, DIGEST_CONFIG.maxMovements)
    .map((h) => {
      const name = nameById.get(h.company_id) ?? "A company";
      const who = h.actor === "System" ? "the model" : h.actor;
      return `${name} moved from ${h.from_state} to ${h.to_state}, by ${who}.`;
    });

  const movementsText =
    movements.length > 0 ? movements.join(" ") : "No companies changed state since the last run.";

  // --- Top news ------------------------------------------------------------
  const topNews = [...news.account_linked, ...news.market_sector]
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, DIGEST_CONFIG.maxNews)
    .map((item) => {
      // Skip the company prefix when the headline already opens with the name.
      const who =
        item.company && !item.headline.toLowerCase().startsWith(item.company.name.toLowerCase())
          ? `${item.company.name}: `
          : "";

      const why = item.why_it_matters ? ` ${item.why_it_matters}` : "";
      return `${who}${item.headline}, via ${item.source_name}.${why}`;
    });

  const newsText =
    topNews.length > 0 ? topNews.join(" ") : "Nothing in the news feed cleared the relevance filter.";

  const closing = "That's the briefing. Full detail is on the dashboard.";

  // Sections in priority order — trimmed from the bottom up to hit the cap.
  const sections: DigestParagraph[] = [
    { heading: "Opening", text: opening },
    { heading: "Needs your attention", text: prioritisedText },
    { heading: "What moved", text: movementsText },
    { heading: "In the news", text: newsText },
    { heading: "Close", text: closing },
  ];

  let paragraphs = sections;
  let trimmed = false;
  const total = (list: DigestParagraph[]) => list.reduce((n, p) => n + countWords(p.text), 0);

  // Drop optional sections (news, then movements) before truncating sentences.
  const droppable = ["In the news", "What moved"];
  for (const heading of droppable) {
    if (total(paragraphs) <= MAX_WORDS) break;
    paragraphs = paragraphs.filter((p) => p.heading !== heading);
    trimmed = true;
  }

  // Still long? shorten the prioritised block sentence by sentence.
  if (total(paragraphs) > MAX_WORDS) {
    paragraphs = paragraphs.map((p) => {
      if (p.heading !== "Needs your attention") return p;
      const kept: string[] = [];
      let budget = MAX_WORDS - total(paragraphs.filter((x) => x.heading !== p.heading));
      for (const sentence of prioritisedSentences) {
        const words = countWords(sentence);
        if (words > budget) break;
        kept.push(sentence);
        budget -= words;
      }
      return { ...p, text: kept.join(" ") || prioritisedSentences[0] || p.text };
    });
    trimmed = true;
  }

  const spokenText = paragraphs.map((p) => p.text).join(" ");
  const wordCount = countWords(spokenText);

  return {
    run_date: dashboard.run_date,
    generated_for: dateLabel,
    paragraphs,
    spoken_text: spokenText,
    word_count: wordCount,
    estimated_seconds: Math.round((wordCount / DIGEST_CONFIG.wordsPerMinute) * 60),
    trimmed,
  };
}

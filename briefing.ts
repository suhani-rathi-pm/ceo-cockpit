/**
 * Morning briefing writer.
 *
 * Deterministic prose: the same run produces the same three paragraphs.
 * No model call. Emphasis is marked with **double asterisks** and rendered
 * with the brand-wash underline by <Narrative />.
 */

export interface BriefingRow {
  name: string;
  rank: number | null;
  final_score: number;
  state: string;
  days_since_last_touchpoint: number | null;
  owner_crm: string | null;
  touchpoint_count: number;
  tier_label: string | null;
  icp_fit: string;
  icp_missing: boolean;
  news_count: number;
}

export interface BriefingNews {
  company_name: string | null;
  headline: string;
  source_name: string;
  published_at: string;
}

export interface BriefingMove {
  company_name: string;
  from_state: string | null;
  to_state: string;
  actor: string;
}

export interface Briefing {
  eyebrow: string;
  paragraphs: string[];
  meta: string;
}

function longDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function list(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function score(n: number) {
  return n.toFixed(1);
}

function lastTouch(days: number | null) {
  if (days === null) return "no touchpoint on record";
  if (days === 0) return "touched today";
  if (days === 1) return "last touched yesterday";
  return `last touched ${days} days ago`;
}

export function buildBriefing(input: {
  runDate: string | null;
  generatedAt: string;
  pipeline: BriefingRow[];
  opportunity: BriefingRow[];
  keepInTouch: BriefingRow[];
  needsReview: BriefingRow[];
  news: BriefingNews[];
  moves: BriefingMove[];
  newsIngested: number;
  newsKept: number;
}): Briefing {
  const {
    runDate,
    generatedAt,
    pipeline,
    opportunity,
    keepInTouch,
    needsReview,
    news,
    moves,
    newsIngested,
    newsKept,
  } = input;

  const eyebrow = runDate
    ? `Morning briefing · generated ${generatedAt} from run ${runDate}`
    : "Morning briefing · no scoring run yet";

  if (!runDate || pipeline.length + opportunity.length + keepInTouch.length === 0) {
    return {
      eyebrow,
      paragraphs: [
        "**There is no scored board this morning.** The engine has not been run against the current book, so nothing has been ranked, classified or held back. Until a run completes, this page has nothing defensible to show you.",
        "Run the scoring engine from Settings. It is deterministic — the same touchpoints, ratings and ICP profiles will always produce the same ranking, so a run can be repeated and audited rather than trusted on faith.",
        "Once a run exists, this briefing names the accounts that need you, what moved since the last run, and which accounts are ranking on incomplete data.",
      ],
      meta: "0 accounts reviewed · no run on record",
    };
  }

  const top = pipeline[0] ?? opportunity[0] ?? keepInTouch[0] ?? needsReview[0]!;
  const second = pipeline[1] ?? opportunity[0] ?? null;

  // ---- Paragraph one: the account that actually needs the CEO today. ----
  const parts: string[] = [];
  if (pipeline.length === 0) {
    parts.push(
      `**Nothing is sitting in Pipeline this morning.** The strongest account on the board is ${top.name} at ${score(top.final_score)}, but it is ${lastTouch(top.days_since_last_touchpoint)}, which is what keeps it out of the group that needs you today. This is a quiet board rather than an empty one.`,
    );
  } else if (pipeline.length === 1) {
    const gap = second ? top.final_score - second.final_score : 0;
    parts.push(
      `**${top.name} is the only account that genuinely needs you today.** It sits at ${score(top.final_score)}${second && gap > 0 ? `, ${score(gap)} points clear of ${second.name}` : ""}, on ${top.touchpoint_count} recorded touchpoints, and it is ${lastTouch(top.days_since_last_touchpoint)}${top.owner_crm ? ` with ${top.owner_crm} carrying the relationship` : ""}. ${top.tier_label ? `Its best meeting on record is rated ${top.tier_label.toLowerCase()}, so the access is there — the question is whether anything is being done with it.` : "It has no high-rated meeting on record yet, so the access is thinner than the score suggests."}`,
    );
  } else {
    const names = pipeline.slice(0, 3).map((r) => r.name);
    parts.push(
      `**${top.name} leads the ${pipeline.length} accounts that need you today**, at ${score(top.final_score)}${second ? ` against ${score(second.final_score)} for ${second.name}` : ""}. ${list(names)} are all inside the top six and all touched in the last week, which is why they are in front of you rather than in the folds below. ${top.name} is ${lastTouch(top.days_since_last_touchpoint)}${top.owner_crm ? `, owned by ${top.owner_crm}` : ""}.`,
    );
  }

  // ---- Paragraph two: movement, and what moved it from outside. ----
  const accountNews = news.filter((n) => n.company_name);
  const movedNames = moves
    .filter((m) => m.from_state && m.from_state !== m.to_state)
    .map((m) => `${m.company_name} (${m.from_state} → ${m.to_state})`);

  const newsSentences = accountNews.slice(0, 3).map(
    (n) =>
      `**${n.headline}** (${n.source_name}, ${longDate(n.published_at)})`,
  );

  if (newsSentences.length > 0) {
    parts.push(
      `Below that, ${accountNews.length === 1 ? "one account moved" : `${Math.min(accountNews.length, 3)} accounts moved`} for reasons that have nothing to do with our own activity. ${newsSentences.join("; ")}. External events like these change the shape of an account before any touchpoint does — the opportunity size on file is likely to be understated where the news points to new funding, a new executive or new capacity. ${movedNames.length > 0 ? `On our own side, ${list(movedNames.slice(0, 3))} changed state since the last run.` : "No account changed state on our own scoring since the last run."}`,
    );
  } else {
    parts.push(
      `Nothing external moved against the book overnight — ${newsKept} items cleared the relevance filter out of ${newsIngested} ingested, and none of them matched an account in the current pipeline. ${movedNames.length > 0 ? `On our own scoring, ${list(movedNames.slice(0, 3))} changed state since the last run.` : "No account changed state since the last run either, so today's board is the same board you left yesterday."} ${opportunity.length > 0 ? `${opportunity.length} accounts are qualified but sitting in Opportunity purely on timing.` : ""}`,
    );
  }

  // ---- Paragraph three: data honesty. ----
  if (needsReview.length > 0) {
    const r = needsReview[0]!;
    parts.push(
      `One thing to be aware of on the data itself: **${r.name} is ranking on an incomplete profile.** Its ICP multiplier is neutral because nobody has completed the assessment, so its position at ${score(r.final_score)} is provisional rather than earned. It has been held out of both tables rather than quietly slotted in${r.owner_crm ? ` — worth ten minutes from ${r.owner_crm} to close that gap before the next run` : ""}.${needsReview.length > 1 ? ` ${needsReview.length - 1} other ${needsReview.length - 1 === 1 ? "account is" : "accounts are"} in the same position.` : ""}`,
    );
  } else {
    const stale = keepInTouch.filter(
      (r) => (r.days_since_last_touchpoint ?? 0) >= 30,
    );
    parts.push(
      `On the data itself: **every ranked account has a complete ICP profile this morning**, so nothing on the board is ranking provisionally. ${stale.length > 0 ? `${list(stale.slice(0, 3).map((r) => r.name))} ${stale.length === 1 ? "has" : "have"} had no contact in over a month and will fall out of scope at sixty days.` : "Nothing is close to the sixty-day exclusion threshold."} ${keepInTouch.length} accounts are in maintenance and need nothing from you today.`,
    );
  }

  const reviewed = pipeline.length + opportunity.length + keepInTouch.length;
  const seconds = Math.round(
    parts.join(" ").split(/\s+/).length / 2.6,
  );
  const meta = `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s · ${reviewed} accounts reviewed · ${newsKept} news items kept from ${newsIngested}`;

  return { eyebrow, paragraphs: parts, meta };
}

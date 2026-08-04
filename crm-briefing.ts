/**
 * The account owner's briefing — written in the second person, about their book
 * only. Deterministic: the same run and the same accounts produce the same
 * paragraphs. No model call.
 *
 * Emphasis is marked with **double asterisks** and rendered with the brand-wash
 * underline by <Narrative />.
 */

export interface CrmBriefingRow {
  name: string;
  state: string;
  rank: number | null;
  days_since_last_touchpoint: number | null;
  touchpoint_count: number;
  tier_label: string | null;
  icp_missing: boolean;
}

export interface CrmBriefing {
  eyebrow: string;
  paragraphs: string[];
  meta: string;
}

function list(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function touch(days: number | null) {
  if (days === null) return "nothing logged against it yet";
  if (days === 0) return "logged today";
  if (days === 1) return "last logged yesterday";
  return `last logged ${days} days ago`;
}

function longDate(value: string | null) {
  if (!value) return "the last run";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function buildCrmBriefing(input: {
  firstName: string;
  runDate: string | null;
  generatedAt: string;
  pipeline: CrmBriefingRow[];
  opportunity: CrmBriefingRow[];
  keepInTouch: CrmBriefingRow[];
  cold: CrmBriefingRow[];
  unreadCount: number;
  pendingCount: number;
  openWithMe: number;
}): CrmBriefing {
  const {
    firstName,
    runDate,
    generatedAt,
    pipeline,
    opportunity,
    keepInTouch,
    cold,
    unreadCount,
    pendingCount,
    openWithMe,
  } = input;

  const total = pipeline.length + opportunity.length + keepInTouch.length;
  const paragraphs: string[] = [];

  // 1 — where their book stands after the run.
  if (total === 0) {
    paragraphs.push(
      `${firstName}, nothing in your book reached the board on the ${longDate(runDate)} run. Log the meetings and calls you have had and they will be scored on the next pass.`,
    );
  } else {
    const top = pipeline[0] ?? opportunity[0] ?? keepInTouch[0]!;
    const lead = `${firstName}, you own **${total} account${total === 1 ? "" : "s"}** on the ${longDate(runDate)} board.`;
    const head = pipeline.length
      ? ` **${top.name}** is the one Ishwari is reading first — it sits at rank ${top.rank ?? "—"} and was ${touch(top.days_since_last_touchpoint)} across ${top.touchpoint_count} touchpoint${top.touchpoint_count === 1 ? "" : "s"}.`
      : ` None of yours are in the pipeline band this morning; **${top.name}** is your strongest at rank ${top.rank ?? "—"}, ${touch(top.days_since_last_touchpoint)}.`;
    const rest = opportunity.length
      ? ` ${list(opportunity.slice(0, 3).map((r) => r.name))} scored well but slipped out of the recent window, which is a timing problem rather than a pricing one.`
      : "";
    paragraphs.push(lead + head + rest);
  }

  // 2 — what is drifting, and what the CEO has asked for.
  const parts: string[] = [];
  if (cold.length) {
    parts.push(
      `**${list(cold.slice(0, 3).map((r) => r.name))}** ${cold.length === 1 ? "has" : "have"} had no contact in fourteen days or more — ${cold[0]!.name} is at ${cold[0]!.days_since_last_touchpoint ?? "—"} days and will drop out of scoring entirely at sixty.`,
    );
  }
  if (unreadCount) {
    parts.push(
      `You have **${unreadCount} unread message${unreadCount === 1 ? "" : "s"} from Ishwari** waiting below, each tied to a specific account.`,
    );
  }
  if (openWithMe) {
    parts.push(
      `${openWithMe} item${openWithMe === 1 ? " is" : "s are"} still open with you on the actions page.`,
    );
  }
  const missing = pipeline.concat(opportunity, keepInTouch).filter((r) => r.icp_missing);
  if (missing.length) {
    parts.push(
      `${list(missing.slice(0, 2).map((r) => r.name))} ${missing.length === 1 ? "is" : "are"} still missing an ICP profile, so ${missing.length === 1 ? "its" : "their"} position is provisional.`,
    );
  }
  paragraphs.push(
    parts.length
      ? parts.join(" ")
      : "Nothing in your book is drifting, nothing is unread, and nothing is sitting open with you. Keep logging as you go.",
  );

  // 3 — the run boundary. Always the closing paragraph.
  paragraphs.push(
    pendingCount
      ? `You have **${pendingCount} submission${pendingCount === 1 ? "" : "s"} waiting**. Nothing you log today changes this board. Scoring runs once, at **04:30 tomorrow**, and everything submitted since the last run is picked up then — ranks, states and the CEO's briefing all move together at that point, not before.`
      : `Anything you log today sits outside this board until the next run. Scoring runs once, at **04:30 tomorrow**, and only then do ranks, states and the CEO's briefing move. Log it now rather than remembering it later.`,
  );

  return {
    eyebrow: `Your briefing · generated ${generatedAt} from run ${runDate ?? "—"}`,
    paragraphs,
    meta: `${total} accounts · ${cold.length} going cold · ${unreadCount} unread · ${pendingCount} waiting on the next run`,
  };
}

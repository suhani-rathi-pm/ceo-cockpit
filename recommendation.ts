/**
 * "Recommended next move" — the answer that sits at the top of an account page.
 *
 * Deterministic: derived from the account's own record (state, rank, recency,
 * latest touchpoint, attached news, ICP completeness). No model call, so the
 * same account always produces the same recommendation and the same deadline.
 */

export type ActionKind = "email" | "outreach" | "note" | "route" | "correct" | "lost";

export interface RecommendationInput {
  name: string;
  state: string | null;
  rank: number | null;
  finalScore: number;
  icpFit: string;
  icpMissing: boolean;
  isActive: boolean;
  daysSinceLastTouch: number | null;
  owner: string | null;
  touchpointCount: number;
  latest: {
    type: string;
    occurredAt: string;
    contactName: string | null;
    contactTitle: string | null;
    oppSize: string | null;
  } | null;
  topNews: { headline: string; source: string; publishedAt: string } | null;
  chiefOfStaff: string;
  today?: Date;
}

export interface Recommendation {
  move: string;
  steps: string[];
  who: string;
  by: string;
  risk: string;
  primary: ActionKind;
  why: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function firstName(full: string | null) {
  return full ? full.split(" ")[0]! : "the account owner";
}

export function buildRecommendation(input: RecommendationInput): Recommendation {
  const today = input.today ?? new Date();
  const owner = input.owner ?? "the owning CRM";
  const contact = input.latest?.contactName ?? null;
  const contactLine = contact
    ? `${contact}${input.latest?.contactTitle ? ` (${input.latest.contactTitle})` : ""}`
    : "the most senior contact on record";
  const lastTouchLine = input.latest
    ? `the ${input.latest.type.toLowerCase()} on ${shortDate(input.latest.occurredAt)}`
    : "the last recorded contact";
  const days = input.daysSinceLastTouch;

  // --- Inactive or lost: the move is to correct the record, not to sell. ---
  if (!input.isActive || input.state === "Lost") {
    const by = addDays(today, 5);
    return {
      move: `Close the record on ${input.name} by ${dayLabel(by)}`,
      steps: [
        `Ask ${owner} to confirm in writing what ${contactLine} actually said, so the reason on file is theirs and not ours.`,
        `Record the outcome against the account with a reason a future run can read — "budget pulled", "incumbent renewed", "no decision maker reachable".`,
        `Set a re-open date if there is one; otherwise let the sixty-day exclusion stand.`,
      ],
      who: owner,
      by: dayLabel(by),
      risk: `Left as it is, ${input.name} keeps consuming attention in reviews while contributing nothing, and the exclusion reason stays as an assumption rather than something anyone told us.`,
      primary: "correct",
      why: `${input.name} is out of scope for the current run — ${input.isActive ? "it has been classified Lost by a human" : "it is marked inactive"} — so its score of ${input.finalScore.toFixed(1)} is history rather than a signal. It is on this page so the decision stays auditable, not so it gets worked.`,
    };
  }

  // --- Incomplete ICP: the move is to complete the data. ---
  if (input.icpMissing) {
    const by = addDays(today, 3);
    return {
      move: `Get the ICP assessment on ${input.name} completed by ${dayLabel(by)}`,
      steps: [
        `Have ${owner} complete the ICP subscores from what is already known — industry, headcount band, and the buying pattern from ${lastTouchLine}.`,
        `Confirm the opportunity size with ${contactLine}; the figure on file is "${input.latest?.oppSize ?? "Unknown"}", which is a guess rather than an answer.`,
        `Re-run scoring once the profile is in so ${input.name} either earns its rank or loses it honestly.`,
      ],
      who: owner,
      by: dayLabel(by),
      risk: `${input.name} keeps ranking at ${input.finalScore.toFixed(1)} on a neutral multiplier. Either it deserves a place in the top six and is being under-served, or it does not and is displacing something that does. Both are wrong.`,
      primary: "note",
      why: `${input.name} has ${input.touchpointCount} touchpoints on record and scores ${input.finalScore.toFixed(1)}, but its ICP profile has never been completed, so the multiplier applied was the neutral 1.0. No penalty was applied and it has not been slotted into the ranked tables — its position is provisional until the profile exists.`,
    };
  }

  // --- Pipeline: something is live and time-sensitive. ---
  if (input.state === "Pipeline") {
    const by = addDays(today, 2);
    return {
      move: `Send ${input.name} a revised commercial position by ${dayLabel(by)}`,
      steps: [
        `Brief ${input.chiefOfStaff} on what came out of ${lastTouchLine} with ${contactLine}, and what we are willing to move on.`,
        `Get ${owner} to confirm the exact wording ${contactLine} used about scope and timing before anything goes back — we should not be guessing at their words.`,
        `Put a dated next step in the reply${input.topNews ? `, referencing "${input.topNews.headline}" (${input.topNews.source}, ${shortDate(input.topNews.publishedAt)}) as the reason it is now rather than next quarter` : ""}.`,
      ],
      who: `${input.chiefOfStaff}, with ${owner}`,
      by: dayLabel(by),
      risk: `${input.name} is rank ${input.rank ?? "—"} at ${input.finalScore.toFixed(1)} and ${days === null ? "has no dated contact" : `was last touched ${days} days ago`}. Silence past this week reads as a lack of interest at their end of the table, and the conversation restarts from a colder place with someone else already in it.`,
      primary: "email",
      why: `${input.name} is in Pipeline because it ranks inside the top six at ${input.finalScore.toFixed(1)} and has been touched inside the last seven days — engagement and seniority are both real, across ${input.touchpointCount} recorded touchpoints. ${input.topNews ? `The account also has news attached: "${input.topNews.headline}", which is the kind of event that makes an existing objection disappear.` : "There is nothing external driving it; this is our own momentum, which means it is ours to lose."}`,
    };
  }

  // --- Opportunity: qualified, but timing or deal shape is missing. ---
  if (input.state === "Opportunity") {
    const by = addDays(today, 5);
    return {
      move: `Get a senior conversation booked at ${input.name} by ${dayLabel(by)}`,
      steps: [
        `Ask ${firstName(input.owner)} for the named decision maker — every touchpoint so far has stopped at ${input.latest?.contactTitle ?? "operational level"}.`,
        `Use ${input.topNews ? `"${input.topNews.headline}" (${input.topNews.source}, ${shortDate(input.topNews.publishedAt)})` : `the outcome of ${lastTouchLine}`} as the reason for the meeting rather than a check-in.`,
        `Set the opportunity size properly on the record once that conversation happens; "${input.latest?.oppSize ?? "Unknown"}" is not a deal shape.`,
      ],
      who: owner,
      by: dayLabel(by),
      risk: `${input.name} is qualified on rating quality rather than deal shape. Without a named signer it will keep scoring well and never close, and it will drift into Keep in touch on the next run that misses the seven-day window.`,
      primary: "note",
      why: `${input.name} ranks inside the top six at ${input.finalScore.toFixed(1)} but has not been touched in the last seven days${days !== null ? ` — ${days} days, in fact` : ""}, which is the only thing separating it from Pipeline. The score is carried by ${input.touchpointCount} touchpoints of good quality; the timing is what is missing.`,
    };
  }

  // --- Keep in touch: maintenance, with a decision about whether to invest. ---
  const by = addDays(today, 10);
  const stale = (days ?? 0) >= 30;
  return {
    move: stale
      ? `Decide whether ${input.name} is worth keeping open, by ${dayLabel(by)}`
      : `Give ${input.name} one substantive reason to talk by ${dayLabel(by)}`,
    steps: [
      `Have ${owner} reopen with something specific from ${lastTouchLine} rather than a general check-in.`,
      input.topNews
        ? `Lead with "${input.topNews.headline}" (${input.topNews.source}, ${shortDate(input.topNews.publishedAt)}) — it gives a reason to be in touch that is about them.`
        : `Route it to the unit best placed to bring something of value — a benchmark, an introduction, or a piece of work already done in their sector.`,
      `If nothing comes back inside two weeks, record it and let the sixty-day exclusion do its job.`,
    ],
    who: owner,
    by: dayLabel(by),
    risk: `At ${days ?? "an unknown number of"} days since contact, ${input.name} is ${stale ? "close to the sixty-day exclusion threshold" : "cooling"}. It will drop out of the ranked board without anyone deciding that it should — an exclusion by neglect rather than by judgement.`,
    primary: "route",
    why: `${input.name} sits in Keep in touch: it did not rank inside the top six on the current run, scoring ${input.finalScore.toFixed(1)} across ${input.touchpointCount} touchpoints with an ICP fit of ${input.icpFit}. Nothing is wrong with it — it simply is not competing for attention this week.`,
  };
}

/** Briefing tuning — one place, so the filter is auditable. */
export const NEWS_CONFIG = {
  /** Items below this relevance score never reach the briefing. */
  minRelevance: 0.5,
  /** How many items are shown before "show more". */
  defaultVisible: 8,
  /**
   * Simulated upstream crawl volume for the prototype. The seeded rows are the
   * items that survived matching; this is the number the connectors saw.
   */
  upstreamIngested: 386,
} as const;

/**
 * Why an item was dismissed. Only "Not material" is evidence about the
 * relevance floor — the other two are matching and de-duplication problems.
 */
export const DISMISS_REASONS = ["Not material", "Wrong company", "Duplicate story"] as const;


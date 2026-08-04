/** Shared option lists for the account owner's side of the product. */
export const TOUCHPOINT_TYPES = ["Meeting", "Call", "Email", "Event"] as const;

export const OPPORTUNITY_SIZES = [
  "$1M+",
  "$250k-1M",
  "$50k-250k",
  "<$50k",
  "Unknown",
  "None identified",
] as const;

export const COLLATERAL_ITEMS = ["Deck", "Case study", "Rate card"] as const;

export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];

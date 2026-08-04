export const BUSINESS_UNITS = ["Sales", "Delivery", "Partnerships", "Finance", "Exec"] as const;
export const ACTION_STATUSES = ["Open", "In progress", "Resolved"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

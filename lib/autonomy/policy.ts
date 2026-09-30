export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const LEVELS: { level: AutonomyLevel; label: string; description: string }[] = [
  { level: 0, label: "Off", description: "Foundry does nothing here." },
  { level: 1, label: "Suggest", description: "Foundry points things out. You decide and do it." },
  { level: 2, label: "Draft for approval", description: "Foundry prepares it. Nothing happens until you approve." },
  { level: 3, label: "Routine on its own", description: "Foundry handles routine cases and asks you about anything unusual." },
  { level: 4, label: "Act and tell you", description: "Foundry acts, then tells you what it did." },
  { level: 5, label: "Act within limits", description: "Foundry acts within limits you set and sends a weekly report." },
];

export const ACTION_TYPES = {
  "capture.record": {
    label: "Turning captures into records",
    description: "Reading what you say, type or photograph into sales, expenses and stock changes.",
    defaultLevel: 2, maxLevel: 2, // Books are only written after a person confirms.
  },
  "growth.recommend": {
    label: "Business suggestions",
    description: "Ideas based on your Pulse, like following up on slow sales or rising costs.",
    defaultLevel: 1, maxLevel: 1,
  },
  "customer.reminder": {
    label: "Payment reminders",
    description: "Polite reminders to customers who owe you, ready to send on WhatsApp.",
    defaultLevel: 2, maxLevel: 2, // No automatic sending channel yet: a person always sends.
  },
  "stock.alert": {
    label: "Stock alerts",
    description: "Warnings when stock runs low or the count looks wrong.",
    defaultLevel: 4, maxLevel: 4,
  },
  "market.match": {
    label: "Opportunity matching",
    description: "Finding contracts, buyers and programs your records qualify you for.",
    defaultLevel: 1, maxLevel: 1,
  },
} as const satisfies Record<string, { label: string; description: string; defaultLevel: AutonomyLevel; maxLevel: AutonomyLevel }>;

export type ActionType = keyof typeof ACTION_TYPES;

export type Mode = "skip" | "suggest" | "await_approval" | "auto_notify";

/** Level actually in force: the owner's choice, capped by what the action can safely do today. */
export function effectiveLevel(type: ActionType, chosen?: number | null): AutonomyLevel {
  const def = ACTION_TYPES[type];
  const level = chosen ?? def.defaultLevel;
  return Math.max(0, Math.min(level, def.maxLevel)) as AutonomyLevel;
}

export function modeFor(level: AutonomyLevel): Mode {
  if (level === 0) return "skip";
  if (level === 1) return "suggest";
  if (level <= 3) return "await_approval";
  return "auto_notify";
}

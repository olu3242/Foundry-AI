import type { Database } from "@/lib/supabase/database.types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Plain-language descriptions of domain events. Unknown types fall back to the raw type. */
const DESCRIBE: Record<string, (p: Payload) => string> = {
  "business.created": (p) => `Business "${str(p.name)}" was set up`,
  "member.added": (p) => `A ${str(p.role)} joined the team`,
  "member.role_changed": (p) => `A team member's role changed from ${str(p.from)} to ${str(p.to)}`,
  "member.removed": () => "A team member left",
  "capture.received": (p) => `New ${str(p.channel)} capture received`,
  "capture.drafted": (p) => `Foundry drafted ${Number(p.drafts ?? 0)} record(s) for you to check`,
  "capture.failed": () => "A capture couldn't be read",
  "sale.recorded": () => "A sale was recorded",
  "expense.recorded": (p) => `An expense (${str(p.category)}) was recorded`,
  "stock.moved": (p) => `Stock of ${str(p.product)} changed by ${String(p.delta)}`,
  "customer.added": (p) => `${str(p.name)} was added as a customer`,
  "draft.rejected": (p) => `A ${str(p.kind).replace("_", " ")} draft was discarded`,
  "pulse.computed": (p) => {
    const n = Array.isArray(p.attention) ? p.attention.length : 0;
    return n ? `Pulse updated: ${n} area(s) need attention` : "Pulse updated: everything looks steady";
  },
  "sale.voided": () => "A sale was voided",
  "expense.voided": () => "An expense was voided",
  "verification.added": (p) => `Proof added: ${str(p.method).replace(/_/g, " ")}`,
  "passport.shared": (p) => `Passport shared with ${str(p.label)}`,
  "passport.revoked": (p) => `Passport link for ${str(p.label)} switched off`,
  "passport.viewed": (p) => `${str(p.label)} viewed your Passport`,
  "agent.proposed": (p) => `Foundry left ${Number(p.count ?? 0)} suggestion(s) in your inbox`,
  "agent.notified": (p) => str(p.title),
  "action.executed": (p) => `Done: ${str(p.title)}`,
  "action.rejected": (p) => `Set aside: ${str(p.title)}`,
  "market.interested": (p) => `You showed interest in “${str(p.title)}”`,
  "job.dead": (p) => `Background task ${str(p.type)} failed and needs attention`,
};

export function describeEvent(event: Pick<EventRow, "type" | "payload">) {
  const fn = DESCRIBE[event.type];
  return fn ? fn((event.payload ?? {}) as Payload) : event.type.replace(/[._]/g, " ");
}

export function registerEventDescriptions(entries: Record<string, (p: Payload) => string>) {
  Object.assign(DESCRIBE, entries);
}

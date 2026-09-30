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
  "job.dead": (p) => `Background task ${str(p.type)} failed and needs attention`,
};

export function describeEvent(event: Pick<EventRow, "type" | "payload">) {
  const fn = DESCRIBE[event.type];
  return fn ? fn((event.payload ?? {}) as Payload) : event.type.replace(/[._]/g, " ");
}

export function registerEventDescriptions(entries: Record<string, (p: Payload) => string>) {
  Object.assign(DESCRIBE, entries);
}

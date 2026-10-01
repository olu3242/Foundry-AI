import { Bot, User, Cog } from "lucide-react";
import { describeEvent, type EventRow } from "@/lib/activity";

const ACTOR_ICON = { user: User, agent: Bot, system: Cog } as const;

export function ActivityFeed({ events }: { events: Pick<EventRow, "id" | "type" | "payload" | "actor_type" | "occurred_at">[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Nothing yet. Activity shows up here as it happens.</p>;
  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const Icon = ACTOR_ICON[e.actor_type];
        return (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className={e.actor_type === "agent" ? "mt-0.5 text-insight" : "mt-0.5 text-muted-foreground"}>
              <Icon className="size-4" aria-label={e.actor_type} />
            </span>
            <span className="flex-1">{describeEvent(e)}</span>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.occurred_at}>
              {new Date(e.occurred_at).toLocaleString("en", { dateStyle: "short", timeStyle: "short" })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

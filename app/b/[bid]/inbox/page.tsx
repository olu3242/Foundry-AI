import type { Metadata } from "next";
import { Bot, Check, Lightbulb, MessageCircle, Package, X } from "lucide-react";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACTION_TYPES, LEVELS, type ActionType } from "@/lib/autonomy/policy";
import { whatsappLink } from "@/lib/growth/rules";
import { formatDate } from "@/lib/utils";
import { decideAction } from "./actions";
import { StartPlanForm } from "@/components/progress/start-plan-form";
import { DIMENSION_METRIC } from "@/lib/interventions/catalog";

export const metadata: Metadata = { title: "Inbox" };

const ICON = { "growth.recommend": Lightbulb, "customer.reminder": MessageCircle, "stock.alert": Package } as Record<string, typeof Bot>;

export default async function InboxPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const canAct = WRITER_ROLES.includes(role);
  const [{ data: proposed }, { data: recent }, { data: notices }] = await Promise.all([
    supabase.from("agent_actions").select("*").eq("business_id", bid).eq("status", "proposed").order("created_at", { ascending: false }).limit(50),
    supabase.from("agent_actions").select("id, title, status, action_type, autonomy_level, decided_at, executed_at, created_at")
      .eq("business_id", bid).neq("status", "proposed").order("created_at", { ascending: false }).limit(20),
    // B23: what routine automation did this week, shown up front (not only in history).
    supabase.from("agent_actions").select("id, title, body, executed_at").eq("business_id", bid).eq("source", "ops-automation").eq("status", "executed")
      .gte("executed_at", new Date(Date.now() - 7 * 864e5).toISOString()).order("executed_at", { ascending: false }).limit(5),
  ]);

  return (
    <>
      <PageHeader eyebrow="Inbox" title="What Foundry suggests"
        description="Suggestions and drafts from Foundry's assistants. Each says why it was made and what level of freedom you've given it. Nothing is sent without you." />
      {!!notices?.length && (
        <section aria-label="From Foundry" className="mb-6 space-y-2">
          {notices.map((n) => (
            <p key={n.id} className="glass p-3 text-sm"><span className="font-medium">{n.title}.</span> {n.body}</p>
          ))}
        </section>
      )}
      <div className="space-y-3">
        {!proposed?.length && <p className="glass p-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
        {proposed?.map((a) => {
          const Icon = ICON[a.action_type] ?? Bot;
          const payload = a.payload as { message?: string; phone?: string | null; dimension?: string; metric?: string; solution_version_id?: string; window_days?: number; plan_title?: string };
          const planMetric = payload.metric ?? (payload.dimension ? DIMENSION_METRIC[payload.dimension] : undefined);
          const meta = ACTION_TYPES[a.action_type as ActionType];
          return (
            <article key={a.id} className="glass space-y-3 p-4" aria-label={a.title}>
              <header className="flex flex-wrap items-center gap-2">
                <Icon className="size-4 text-insight" aria-hidden />
                <h2 className="font-semibold">{a.title}</h2>
                <Badge tone="insight" className="ml-auto">L{a.autonomy_level} · {LEVELS[a.autonomy_level]?.label}</Badge>
              </header>
              {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
              {payload.message && <blockquote className="rounded-xl border-l-4 border-growth bg-muted/50 p-3 text-sm">{payload.message}</blockquote>}
              <p className="text-xs text-muted-foreground">{meta?.label ?? a.action_type} · from {a.source ?? "assistant"} · {formatDate(a.created_at)}</p>
              {canAct && (
                <div className="flex flex-wrap gap-2">
                  {a.action_type === "customer.reminder" && payload.message ? (
                    <form action={decideAction}>
                      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="actionId" value={a.id} /><input type="hidden" name="decision" value="executed" />
                      <Button asChild size="sm"><a href={whatsappLink(payload.phone ?? null, payload.message)} target="_blank" rel="noreferrer"><MessageCircle /> Send on WhatsApp</a></Button>
                      <Button size="sm" variant="outline" className="ml-2"><Check /> Mark as sent</Button>
                    </form>
                  ) : planMetric ? (
                    <StartPlanForm compact businessId={bid} defaults={{ title: payload.plan_title ?? a.title, metric: planMetric, sourceActionId: a.id,
                      solutionVersionId: payload.solution_version_id, windowDays: payload.window_days }} />
                  ) : (
                    <form action={decideAction}>
                      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="actionId" value={a.id} /><input type="hidden" name="decision" value="executed" />
                      <Button size="sm"><Check /> Done</Button>
                    </form>
                  )}
                  <form action={decideAction}>
                    <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="actionId" value={a.id} /><input type="hidden" name="decision" value="rejected" />
                    <Button size="sm" variant="ghost"><X /> Not now</Button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!!recent?.length && (
        <section className="mt-10">
          <h2 className="eyebrow mb-3">History</h2>
          <ul className="glass divide-y text-sm">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <span className="flex-1 truncate">{a.title}</span>
                <Badge tone={a.status === "executed" ? "brand" : "neutral"}>{a.status === "executed" ? (a.autonomy_level >= 4 ? "Done by Foundry" : "Done") : a.status}</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(a.executed_at ?? a.decided_at ?? a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

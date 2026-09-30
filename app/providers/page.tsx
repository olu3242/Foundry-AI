import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegisterProviderForm, SubmitSolutionForm } from "@/components/marketplace/provider-forms";
import { formatDate } from "@/lib/utils";
import { postUpdate } from "./actions";

export const metadata: Metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const user = await requireUser("/providers");
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("provider_members").select("provider_id, providers(*)").eq("user_id", user.id);
  const providers = (memberships ?? []).map((m) => m.providers).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const details = await Promise.all(providers.map(async (p) => {
    const [{ data: solutions }, { data: engagements }, { data: stats }] = await Promise.all([
      supabase.from("solutions").select("id, name, status, review_note, price_minor, currency, pricing_model").eq("provider_id", p.id).order("created_at", { ascending: false }),
      p.status === "approved" ? supabase.rpc("provider_engagements", { p_provider_id: p.id }) : Promise.resolve({ data: [] }),
      supabase.rpc("solution_effectiveness", {}),
    ]);
    return { p, solutions: solutions ?? [], engagements: engagements ?? [], stats: stats ?? [] };
  }));

  return (
    <SimpleShell>
      <PageHeader eyebrow="Marketplace" title="Offer solutions to businesses"
        description="Providers list solutions that businesses start from their Progress page. Every solution is reviewed, measured on real results, and audited. You see plan progress and results, never a business's books." />
      {!providers.length && <Card><CardHeader><CardTitle>Register as a provider</CardTitle></CardHeader><RegisterProviderForm /></Card>}
      {details.map(({ p, solutions, engagements, stats }) => (
        <div key={p.id} className="space-y-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">{p.name} <Badge tone={p.status === "approved" ? "brand" : "opportunity"}>{p.status}</Badge></h2>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Your solutions</CardTitle></CardHeader>
              <ul className="divide-y text-sm">
                {solutions.map((s) => {
                  const st = stats.find((x) => x.solution_id === s.id);
                  return (
                    <li key={s.id} className="py-3" aria-label={s.name}>
                      <p className="font-medium">{s.name} <Badge>{s.status}</Badge></p>
                      {s.review_note && <p className="text-xs text-muted-foreground">Review: {s.review_note}</p>}
                      {st && <p className="text-xs">{st.activated} started · {st.completed} completed · {st.improved} improved · {st.verified} verified</p>}
                    </li>
                  );
                })}
                {!solutions.length && <li className="py-3 text-muted-foreground">None yet.</li>}
              </ul>
            </Card>
            {p.status === "approved" ? (
              <Card><CardHeader><CardTitle>Submit a solution</CardTitle></CardHeader><SubmitSolutionForm providerId={p.id} /></Card>
            ) : <Card><CardDescription>Your profile is waiting for review. You can submit solutions once it is approved.</CardDescription></Card>}
          </div>
          {!!engagements.length && (
            <Card>
              <CardHeader><CardTitle>Businesses you&apos;re working with</CardTitle></CardHeader>
              <ul className="divide-y text-sm">
                {engagements.map((e) => (
                  <li key={e.engagement_id} className="space-y-2 py-3" aria-label={`Engagement with ${e.business_name}`}>
                    <p><span className="font-medium">{e.business_name}</span> · {e.solution} · {e.plan_status} · ends {formatDate(e.due_at)}
                      {e.result_status && ` · result ${e.result_improved ? "improved" : "not improved"} (${e.result_status})`}</p>
                    {(e.updates as { note: string; at: string }[]).map((u, i) => <p key={i} className="text-xs text-muted-foreground">{formatDate(u.at)}: {u.note}</p>)}
                    {e.plan_status === "active" && (
                      <form action={postUpdate} className="flex gap-2">
                        <input type="hidden" name="engagementId" value={e.engagement_id} />
                        <Input name="note" aria-label="Progress update" placeholder="What happened this week?" className="h-9 text-xs" required minLength={2} />
                        <Button size="sm" variant="outline">Post update</Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ))}
    </SimpleShell>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { decideChange } from "../actions";

export const metadata: Metadata = { title: "Approvals" };

export default async function ChangesPage() {
  const user = await requireUser("/admin/changes");
  const supabase = await createClient();
  const [{ data: changes }, { data: setting }] = await Promise.all([
    supabase.from("change_requests").select("*").order("requested_at", { ascending: false }).limit(50),
    supabase.from("platform_settings").select("value").eq("key", "dual_approval").maybeSingle(),
  ]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Approvals" description="Sensitive changes (policies, packs, markets, dataset publication, platform settings) need a second admin. The requester can't approve their own change." />
      <p className="mb-4 text-sm">Dual approval: <Badge tone={setting?.value === true ? "brand" : "attention"} data-testid="dual-approval">{setting?.value === true ? "on" : "off"}</Badge></p>
      <Card aria-label="Change requests">
        <CardHeader><CardTitle>Change requests</CardTitle><CardDescription>Approving applies the change immediately and atomically; failures keep their reason.</CardDescription></CardHeader>
        <ul className="divide-y text-sm">{changes?.map((c) => (
          <li key={c.id} className="space-y-1 py-3" aria-label={`Change ${c.kind} ${c.target}`}>
            <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.kind.replace("_", " ")}</span><code className="text-xs">{c.target}</code>
              <Badge tone={c.status === "applied" ? "brand" : c.status === "pending" ? "opportunity" : "neutral"}>{c.status}</Badge></p>
            <p className="text-xs text-muted-foreground">{c.reason} · requested {formatDate(c.requested_at)}{c.error ? ` · ${c.error}` : ""}</p>
            {c.status === "pending" && c.requested_by !== user.id && (
              <div className="flex gap-2">
                <form action={decideChange}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="approve" /><Button size="sm">Approve and apply</Button></form>
                <form action={decideChange}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="reject" /><Button size="sm" variant="outline">Reject</Button></form>
              </div>
            )}
            {c.status === "pending" && c.requested_by === user.id && <p className="text-xs text-muted-foreground">Waiting for another admin.</p>}
          </li>))}
          {!changes?.length && <li className="py-3 text-muted-foreground">No change requests.</li>}</ul>
      </Card>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrgForm } from "@/components/orgs/forms";

export const metadata: Metadata = { title: "Organizations" };

export default async function OrgsPage() {
  const user = await requireUser("/orgs");
  const supabase = await createClient();
  const { data } = await supabase.from("org_members").select("role, organizations(id, name, kind)").eq("user_id", user.id);
  return (
    <SimpleShell>
      <PageHeader eyebrow="Enterprise" title="Organizations" description="Run several programs under one institution, with shared policy, sponsorship and reporting. Businesses stay in control of their own data." />
      <Card className="mb-6"><CardHeader><CardTitle>New organization</CardTitle></CardHeader><CreateOrgForm /></Card>
      <ul className="glass divide-y text-sm">{data?.map((m) => m.organizations && (
        <li key={m.organizations.id} className="p-3"><Link className="font-medium hover:underline" href={`/orgs/${m.organizations.id}`}>{m.organizations.name}</Link>
          <span className="text-xs text-muted-foreground"> · {m.organizations.kind} · {m.role}</span></li>))}</ul>
    </SimpleShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateProgramForm } from "@/components/programs/forms";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const user = await requireUser("/programs");
  const supabase = await createClient();
  const { data: mine } = await supabase.from("program_members").select("role, programs(id, name, sponsor_name, status)").eq("user_id", user.id);
  return (
    <SimpleShell>
      <PageHeader eyebrow="Programs" title="Cohorts you run or support"
        description="For sponsors, banks and agencies. Businesses join with a code and choose to share their records; they can leave at any time." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="glass divide-y">
          {!mine?.length && <p className="p-6 text-sm text-muted-foreground">You&apos;re not part of a program yet.</p>}
          {mine?.map((m) => m.programs && (
            <Link key={m.programs.id} href={`/programs/${m.programs.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
              <div className="flex-1"><p className="font-medium">{m.programs.name}</p><p className="text-xs text-muted-foreground">{m.programs.sponsor_name ?? "No sponsor listed"}</p></div>
              <Badge tone={m.role === "admin" ? "trust" : "neutral"}>{m.role === "admin" ? "Admin" : "Business partner"}</Badge>
            </Link>
          ))}
        </div>
        <Card><CardHeader><CardTitle>Start a program</CardTitle></CardHeader><CreateProgramForm /></Card>
      </div>
    </SimpleShell>
  );
}

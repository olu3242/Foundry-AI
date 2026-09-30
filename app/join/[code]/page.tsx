import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { JoinProgramForm } from "@/app/b/[bid]/settings/forms";

export const metadata: Metadata = { title: "Join a program" };

/** B15 invite link: sign in, pick the business, consent explicitly. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser(`/join/${code}`);
  const supabase = await createClient();
  const { data: owned } = await supabase.from("memberships").select("business_id, businesses(name)").eq("user_id", user.id).eq("role", "owner");
  return (
    <SimpleShell>
      <PageHeader eyebrow="Invitation" title="Join a program" description="Joining shares your records, Pulse and Passport with the program team. You can leave at any time." />
      {!owned?.length ? (
        <Card><p className="text-sm">First, <Link href="/onboarding" className="font-medium text-growth hover:underline">set up your business</Link>, then open this link again.</p></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {owned.map((m) => (
            <Card key={m.business_id}>
              <h2 className="mb-3 font-semibold">{m.businesses?.name}</h2>
              <JoinProgramForm businessId={m.business_id} code={code} />
            </Card>
          ))}
        </div>
      )}
    </SimpleShell>
  );
}

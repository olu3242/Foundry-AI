import type { Metadata } from "next";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PassportView } from "@/components/passport/passport-view";
import { ShareForm } from "@/components/passport/share-form";
import { ProofForm } from "@/components/passport/proof-form";
import { loadPassport, PASSPORT_SECTIONS, SECTION_LABEL, type PassportSection } from "@/lib/passport/facts";
import { formatDate } from "@/lib/utils";
import { revokeShare } from "./actions";

export const metadata: Metadata = { title: "Passport" };

export default async function PassportPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const { facts, pulse } = await loadPassport(bid, PASSPORT_SECTIONS);
  const isOwner = role === "owner";
  const { data: shares } = isOwner
    ? await supabase.from("passport_shares").select("id, label, sections, expires_at, revoked_at, view_count, last_viewed_at").eq("business_id", bid).order("created_at", { ascending: false })
    : { data: [] };
  const now = Date.now();

  return (
    <>
      <PageHeader eyebrow="Passport" title="Your proof, on your terms"
        description="Share your track record with a bank, supplier or program. You choose what they see and for how long, and you can switch a link off at any time." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <PassportView facts={facts} pulse={pulse} sections={PASSPORT_SECTIONS} />
        <div className="space-y-6">
          {WRITER_ROLES.includes(role) && (
            <Card>
              <CardHeader><CardTitle>Add proof</CardTitle><CardDescription>Statements, invoices or registration move you up the ladder. Documents stay private; share links only show that proof exists.</CardDescription></CardHeader>
              <ProofForm businessId={bid} />
            </Card>
          )}
          {isOwner && (
            <Card>
              <CardHeader><CardTitle>Share your Passport</CardTitle></CardHeader>
              <ShareForm businessId={bid} />
              {!!shares?.length && (
                <ul className="mt-6 divide-y text-sm">
                  {shares.map((s) => {
                    const active = !s.revoked_at && new Date(s.expires_at).getTime() > now;
                    return (
                      <li key={s.id} className="flex items-start gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.sections.map((x) => SECTION_LABEL[x as PassportSection] ?? x).join(", ")} · {s.view_count} view{s.view_count === 1 ? "" : "s"}
                            {s.last_viewed_at ? `, last ${formatDate(s.last_viewed_at)}` : ""}
                          </p>
                        </div>
                        {active ? (
                          <form action={revokeShare}>
                            <input type="hidden" name="businessId" value={bid} />
                            <input type="hidden" name="shareId" value={s.id} />
                            <button className="text-xs font-medium text-destructive hover:underline">Switch off</button>
                          </form>
                        ) : <Badge>{s.revoked_at ? "Switched off" : "Expired"}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

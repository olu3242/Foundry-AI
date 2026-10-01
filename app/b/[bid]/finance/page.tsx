import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eligibility } from "@/components/finance/eligibility";
import { ShareEvidenceForm } from "@/components/finance/share-form";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { withdrawPackage } from "./actions";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, role, supabase } = await requireBusiness(bid, ["owner", "staff"]);
  const [{ data: products }, { data: packages }] = await Promise.all([
    supabase.from("financial_products").select("*, programs(name, sponsor_name)").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("evidence_packages").select("id, status, submitted_at, requested_amount_minor, decision_note, decision_amount_minor, expires_at, financial_products(name, currency)")
      .eq("business_id", bid).order("submitted_at", { ascending: false }),
  ]);
  const checks = await Promise.all((products ?? []).map(async (p) => (await supabase.rpc("product_eligibility", { p_business_id: bid, p_product_id: p.id })).data));

  return (
    <>
      <PageHeader eyebrow="Finance" title="Finance you can apply for with your records"
        description="Each partner sets its own requirements. Foundry shows which you meet; it never gives you a credit score. You choose what to share, and you can withdraw it." />
      {!!packages?.length && (
        <Card className="mb-6">
          <CardHeader><CardTitle>What you&apos;ve shared</CardTitle></CardHeader>
          <ul className="divide-y text-sm">
            {packages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3" aria-label={`Package for ${p.financial_products?.name}`}>
                <span className="flex-1">{p.financial_products?.name} · {formatMoney(p.requested_amount_minor ?? 0, p.financial_products?.currency ?? business.currency)} · shared {formatDate(p.submitted_at)}
                  {p.decision_note && <span className="block text-xs text-muted-foreground">Partner says: {p.decision_note}</span>}
                </span>
                <Badge tone={p.status === "approved" ? "brand" : p.status === "declined" ? "attention" : "neutral"}>{p.status.replace("_", " ")}</Badge>
                {role === "owner" && !["withdrawn"].includes(p.status) && (
                  <form action={withdrawPackage}><input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={p.id} />
                    <button className="text-xs font-medium text-destructive hover:underline">Withdraw</button></form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {!products?.length && <p className="glass p-6 text-sm text-muted-foreground">No finance partners are listed yet.</p>}
        {products?.map((p, i) => {
          const result = checks[i] as { eligible: boolean; checks: { rule: string; required: unknown; actual: unknown; pass: boolean }[] } | null;
          return (
            <Card key={p.id} aria-label={p.name}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.programs?.name} · {p.product_type.replace("_", " ")} · {formatMoney(p.min_amount_minor ?? 0, p.currency)}–{formatMoney(p.max_amount_minor ?? 0, p.currency)}</CardDescription>
              </CardHeader>
              {result && <Eligibility result={result} />}
              {result && (
                <p className="my-3 text-sm font-medium">{result.eligible ? "You meet this partner's requirements." : "Not yet: see what's missing above."}</p>
              )}
              {role === "owner" && result?.eligible && <ShareEvidenceForm businessId={bid} productId={p.id} currency={p.currency} required={p.required_sections} />}
            </Card>
          );
        })}
      </div>
    </>
  );
}

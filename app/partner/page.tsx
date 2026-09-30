import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { PortfolioTable } from "@/components/programs/portfolio-table";
import { loadPortfolio } from "@/lib/programs/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

/** Businesses a human partner supports: assigned through a program, or invited directly as a partner. */
export default async function PartnerPage() {
  const user = await requireUser("/partner");
  const supabase = await createClient();
  const [{ data: assigned }, { data: direct }] = await Promise.all([
    supabase.from("partner_assignments").select("business_id").eq("partner_user_id", user.id),
    supabase.from("memberships").select("business_id").eq("user_id", user.id).eq("role", "partner"),
  ]);
  const ids = [...new Set([...(assigned ?? []), ...(direct ?? [])].map((r) => r.business_id))];
  const rows = await loadPortfolio(supabase, ids);
  const attention = rows.filter((r) => r.states.at_risk).length;

  return (
    <SimpleShell>
      <PageHeader eyebrow="Business partner" title="Your portfolio"
        description={`${rows.length} business${rows.length === 1 ? "" : "es"}${attention ? `, ${attention} with signals that need attention` : ""}. Open one to see its Pulse, records and Passport (read-only).`} />
      <div className="glass">
        <PortfolioTable rows={rows.sort((a, b) => (b.states.at_risk ?? 0) - (a.states.at_risk ?? 0))} />
      </div>
    </SimpleShell>
  );
}

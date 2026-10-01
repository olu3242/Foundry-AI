import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketForm } from "@/components/admin/market-form";

export const metadata: Metadata = { title: "Markets" };

export default async function MarketsPage() {
  const supabase = await createClient();
  const { data: markets } = await supabase.from("markets").select("*").order("name");
  return (
    <>
      <PageHeader eyebrow="Admin" title="Markets" description="Country, currency, language, identifiers, jurisdiction rules, connectors and data residency. Each market is configuration; the product is the same everywhere." />
      <div className="glass mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr>{["Market", "Currency", "Timezone", "Languages", "Identifiers", "Mobile money", "Residency", "Status"].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {markets?.map((m) => (
              <tr key={m.country_code} aria-label={m.name}>
                <td className="p-3 font-medium">{m.name} ({m.country_code})</td><td className="p-3">{m.currency}</td><td className="p-3">{m.default_timezone}</td>
                <td className="p-3">{m.languages.join(", ")}</td>
                <td className="p-3 text-xs">{(m.identifier_types as { label: string }[]).map((t) => t.label).join(", ")}</td>
                <td className="p-3 text-xs">{((m.connectors as { mobile_money?: string[] }).mobile_money ?? []).join(", ")}</td>
                <td className="p-3">{m.data_residency}</td><td className="p-3"><Badge tone={m.status === "active" ? "brand" : "neutral"}>{m.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card><CardHeader><CardTitle>Add or update a market</CardTitle></CardHeader><MarketForm /></Card>
    </>
  );
}

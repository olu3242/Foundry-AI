import type { Metadata } from "next";
import Link from "next/link";
import { Ban } from "lucide-react";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Kpis } from "@/components/records/kpis";
import { EntryForm } from "@/components/records/entry-form";
import { formatMoney } from "@/lib/money";
import { monthRange } from "@/lib/dates";
import { PAYMENT_LABEL } from "@/lib/records/schemas";
import { cn, formatDate } from "@/lib/utils";
import { voidRecord } from "./actions";

export const metadata: Metadata = { title: "Records" };

const TABS = [
  { key: "sales", label: "Sales", kind: "sale" },
  { key: "expenses", label: "Expenses", kind: "expense" },
  { key: "stock", label: "Stock", kind: "stock_movement" },
  { key: "customers", label: "Customers", kind: "customer" },
] as const;

export default async function RecordsPage({ params, searchParams }: { params: Promise<{ bid: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { bid } = await params;
  const { tab: tabKey } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];
  const { business, role, supabase } = await requireBusiness(bid);
  const canWrite = WRITER_ROLES.includes(role);
  const cur = business.currency;
  const month = monthRange(business.timezone);
  const { data: summary } = await supabase
    .rpc("business_summary", { p_business_id: bid, p_from: month.from.toISOString(), p_to: month.to.toISOString() })
    .single();

  return (
    <>
      <PageHeader eyebrow="Records" title="Your books" description="Everything recorded, with where each record came from." />
      {summary && <Kpis summary={summary} currency={cur} period="this month" />}
      <nav aria-label="Record types" className="my-6 flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`?tab=${t.key}`} aria-current={t.key === tab.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-sm font-medium text-muted-foreground", t.key === tab.key && "bg-surface text-foreground shadow-glass")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {canWrite && <div className="mb-6"><EntryForm key={tab.kind} businessId={bid} kind={tab.kind} currency={cur} /></div>}
      <div className="glass divide-y">
        {tab.key === "sales" && <SalesList bid={bid} canWrite={canWrite} cur={cur} supabase={supabase} />}
        {tab.key === "expenses" && <ExpensesList bid={bid} canWrite={canWrite} cur={cur} supabase={supabase} />}
        {tab.key === "stock" && <StockList bid={bid} supabase={supabase} />}
        {tab.key === "customers" && <CustomersList bid={bid} supabase={supabase} />}
      </div>
    </>
  );
}

type Sb = Awaited<ReturnType<typeof requireBusiness>>["supabase"];

function Source({ draftId }: { draftId: string | null }) {
  return draftId ? <Badge tone="insight">From capture</Badge> : <Badge>Entered by hand</Badge>;
}

function VoidButton({ bid, kind, id }: { bid: string; kind: "sale" | "expense"; id: string }) {
  return (
    <form action={voidRecord}>
      <input type="hidden" name="businessId" value={bid} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-muted-foreground hover:text-destructive" aria-label="Void this record"><Ban className="size-4" /></button>
    </form>
  );
}

const Empty = ({ what }: { what: string }) => <p className="p-6 text-sm text-muted-foreground">No {what} yet.</p>;

async function SalesList({ bid, cur, canWrite, supabase }: { bid: string; cur: string; canWrite: boolean; supabase: Sb }) {
  const { data } = await supabase
    .from("sales")
    .select("id, occurred_at, total_minor, amount_paid_minor, payment_method, voided_at, source_draft_id, customers(name), sale_items(description, quantity)")
    .eq("business_id", bid).order("occurred_at", { ascending: false }).limit(50);
  if (!data?.length) return <Empty what="sales" />;
  return data.map((s) => (
    <div key={s.id} className={cn("flex items-center gap-3 p-4 text-sm", s.voided_at && "opacity-50 line-through")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.sale_items.map((i) => `${Number(i.quantity)} × ${i.description}`).join(", ") || "Sale"}</p>
        <p className="text-xs text-muted-foreground">{formatDate(s.occurred_at)} · {s.customers?.name ?? "Walk-in"} · {PAYMENT_LABEL[s.payment_method]}</p>
      </div>
      <Source draftId={s.source_draft_id} />
      <div className="text-right tabular-nums">
        <p className="font-semibold">{formatMoney(s.total_minor, cur)}</p>
        {s.amount_paid_minor < s.total_minor && <p className="text-xs text-gold-ink">owes {formatMoney(s.total_minor - s.amount_paid_minor, cur)}</p>}
      </div>
      {canWrite && !s.voided_at && <VoidButton bid={bid} kind="sale" id={s.id} />}
    </div>
  ));
}

async function ExpensesList({ bid, cur, canWrite, supabase }: { bid: string; cur: string; canWrite: boolean; supabase: Sb }) {
  const { data } = await supabase
    .from("expenses").select("id, occurred_at, category, description, supplier, amount_minor, payment_method, voided_at, source_draft_id")
    .eq("business_id", bid).order("occurred_at", { ascending: false }).limit(50);
  if (!data?.length) return <Empty what="expenses" />;
  return data.map((e) => (
    <div key={e.id} className={cn("flex items-center gap-3 p-4 text-sm", e.voided_at && "opacity-50 line-through")}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{e.category}{e.description ? ` · ${e.description}` : ""}</p>
        <p className="text-xs text-muted-foreground">{formatDate(e.occurred_at)}{e.supplier ? ` · ${e.supplier}` : ""} · {PAYMENT_LABEL[e.payment_method]}</p>
      </div>
      <Source draftId={e.source_draft_id} />
      <p className="font-semibold tabular-nums">{formatMoney(e.amount_minor, cur)}</p>
      {canWrite && !e.voided_at && <VoidButton bid={bid} kind="expense" id={e.id} />}
    </div>
  ));
}

async function StockList({ bid, supabase }: { bid: string; supabase: Sb }) {
  const { data } = await supabase.from("products").select("id, name, unit, stock_qty, reorder_level").eq("business_id", bid).order("name");
  if (!data?.length) return <Empty what="products" />;
  return data.map((p) => {
    const qty = Number(p.stock_qty);
    const low = p.reorder_level !== null && qty <= Number(p.reorder_level);
    return (
      <div key={p.id} className="flex items-center gap-3 p-4 text-sm">
        <p className="flex-1 font-medium">{p.name}</p>
        {qty < 0 && <Badge tone="attention">Check count</Badge>}
        {low && qty >= 0 && <Badge tone="opportunity">Low</Badge>}
        <p className="font-semibold tabular-nums">{qty} {p.unit ?? ""}</p>
      </div>
    );
  });
}

async function CustomersList({ bid, supabase }: { bid: string; supabase: Sb }) {
  const { data } = await supabase.from("customers").select("id, name, phone, sales(total_minor, amount_paid_minor, voided_at)").eq("business_id", bid).order("name");
  if (!data?.length) return <Empty what="customers" />;
  return data.map((c) => {
    const live = c.sales.filter((s) => !s.voided_at);
    const owes = live.reduce((sum, s) => sum + s.total_minor - s.amount_paid_minor, 0);
    return (
      <div key={c.id} className="flex items-center gap-3 p-4 text-sm">
        <div className="flex-1">
          <p className="font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.phone ?? "No phone"} · {live.length} purchases</p>
        </div>
        {owes > 0 && <Badge tone="opportunity">Owes</Badge>}
      </div>
    );
  });
}

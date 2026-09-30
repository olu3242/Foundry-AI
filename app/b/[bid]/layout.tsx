import { requireBusiness } from "@/lib/auth/guards";
import { AppShell } from "@/components/shell/app-shell";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ bid: string }>;
}) {
  const { bid } = await params;
  const { business, supabase } = await requireBusiness(bid);
  const [{ data: businesses }, { count: inboxCount }] = await Promise.all([
    supabase.from("businesses").select("id, name").is("archived_at", null).order("name"),
    supabase.from("agent_actions").select("id", { count: "exact", head: true }).eq("business_id", bid).eq("status", "proposed"),
  ]);
  return (
    <AppShell businessId={business.id} businessName={business.name} businesses={businesses ?? []} inboxCount={inboxCount ?? 0} locale={business.locale}>
      {children}
    </AppShell>
  );
}

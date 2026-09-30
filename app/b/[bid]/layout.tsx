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
  const { data: businesses } = await supabase.from("businesses").select("id, name").is("archived_at", null).order("name");
  return (
    <AppShell businessId={business.id} businessName={business.name} businesses={businesses ?? []}>
      {children}
    </AppShell>
  );
}

import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/activity-feed";

export default async function TodayPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, supabase } = await requireBusiness(bid);
  const { data: events } = await supabase
    .from("events")
    .select("id, type, payload, actor_type, occurred_at")
    .eq("business_id", bid)
    .order("occurred_at", { ascending: false })
    .limit(15);
  return (
    <>
      <PageHeader eyebrow="Today" title={business.name} description="Your business at a glance." />
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <ActivityFeed events={events ?? []} />
      </Card>
    </>
  );
}

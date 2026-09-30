import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";

export default async function TodayPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business } = await requireBusiness(bid);
  return <PageHeader eyebrow="Today" title={business.name} description="Your business at a glance." />;
}

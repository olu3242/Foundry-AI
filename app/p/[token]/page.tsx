import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { PassportView } from "@/components/passport/passport-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken, hashViewer } from "@/lib/passport/token";
import { loadPassport, PASSPORT_SECTIONS, type PassportSection } from "@/lib/passport/facts";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Passport", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedPassportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{20,64}$/.test(token)) notFound();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!(await rateLimit(`passport:${ip}`, LIMITS.passportView))) {
    return <main className="container py-24 text-center text-muted-foreground">Too many requests. Try again in a minute.</main>;
  }

  const admin = createAdminClient();
  const { data: share } = await admin.from("passport_shares")
    .select("id, business_id, label, sections, expires_at, revoked_at, view_count").eq("token_hash", hashShareToken(token)).maybeSingle();
  // Same response for unknown, revoked and expired links: nothing to probe.
  if (!share || share.revoked_at || new Date(share.expires_at).getTime() < Date.now()) notFound();

  const sections = share.sections.filter((s): s is PassportSection => (PASSPORT_SECTIONS as readonly string[]).includes(s));
  const { facts, pulse } = await loadPassport(share.business_id, sections);

  await Promise.all([
    admin.from("passport_views").insert({ share_id: share.id, business_id: share.business_id, viewer_hash: hashViewer(ip) }),
    admin.from("passport_shares").update({ view_count: share.view_count + 1, last_viewed_at: new Date().toISOString() }).eq("id", share.id),
    admin.from("events").insert({ business_id: share.business_id, type: "passport.viewed", actor_type: "system", entity_type: "passport_share", entity_id: share.id, payload: { label: share.label } }),
  ]);

  return (
    <div className="container max-w-4xl py-8">
      <header className="mb-6 flex items-center justify-between"><Logo /><span className="text-xs text-muted-foreground">Shared with {share.label} · valid until {formatDate(share.expires_at)}</span></header>
      <main id="main"><PassportView facts={facts} pulse={pulse} sections={sections} /></main>
      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Records are kept by the business on Foundry. Each figure shows how it is backed. Foundry does not score or rate creditworthiness.
      </footer>
    </div>
  );
}

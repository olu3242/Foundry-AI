import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/guards";
import { OnboardingForm } from "./onboarding-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const supabase = await createClient();
  const { data: markets } = await supabase.from("markets").select("country_code, name, currency, default_timezone, status").order("name");
  return (
    <main id="main" className="container flex min-h-dvh items-center justify-center py-12">
      <div className="glass w-full max-w-md space-y-6 p-8">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
          <p className="text-sm text-muted-foreground">Takes a minute. You can change it later.</p>
        </div>
        <OnboardingForm markets={(markets ?? []).map((m) => ({ code: m.country_code, name: m.name, currency: m.currency, timezone: m.default_timezone, beta: m.status === "beta" }))} />
      </div>
    </main>
  );
}

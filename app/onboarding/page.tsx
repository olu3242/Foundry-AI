import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/guards";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  return (
    <main id="main" className="container flex min-h-dvh items-center justify-center py-12">
      <div className="glass w-full max-w-md space-y-6 p-8">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1>
          <p className="text-sm text-muted-foreground">Takes a minute. You can change it later.</p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}

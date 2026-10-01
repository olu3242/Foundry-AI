import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getUser, safeNext } from "@/lib/auth/guards";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if (await getUser()) redirect(target);
  return (
    <main id="main" className="container flex min-h-dvh items-center justify-center py-12">
      <div className="glass w-full max-w-sm space-y-6 p-8">
        <Logo />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to Foundry</h1>
          <p className="text-sm text-muted-foreground">New here? The same steps create your account.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            That sign-in link has expired. Request a new one.
          </p>
        )}
        <LoginForm next={target} />
      </div>
    </main>
  );
}

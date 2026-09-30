import Link from "next/link";
import { ArrowRight, Mic, ShieldCheck, Activity, Store } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const pillars = [
  { icon: Mic, title: "Speak it, keep it", body: "Say, type or photograph a sale. Foundry turns it into a record you confirm." },
  { icon: Activity, title: "Pulse", body: "Nine plain-language signals on how your business is doing, and what to do next." },
  { icon: ShieldCheck, title: "Passport", body: "Proof of your track record, with the source of every number. Not a credit score." },
  { icon: Store, title: "Market", body: "Opportunities matched to what your records can prove." },
];

export default function Home() {
  return (
    <div className="container flex min-h-dvh flex-col">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>
      <main id="main" className="flex flex-1 flex-col justify-center gap-12 py-16">
        <div className="max-w-2xl space-y-6">
          <p className="eyebrow">Build the business behind the business</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Run better. Sell more. Keep more. <span className="text-growth">Prove it.</span> Grow.
          </h1>
          <p className="text-lg text-muted-foreground">
            Foundry is the AI-native operating system for small and informal businesses in Africa, built for low-cost
            phones, patchy networks, voice, cash and mobile money.
          </p>
          <Button asChild size="lg">
            <Link href="/login">
              Get started <ArrowRight />
            </Link>
          </Button>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ icon: Icon, title, body }) => (
            <li key={title} className="glass p-5">
              <Icon className="mb-3 size-5 text-growth" aria-hidden />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

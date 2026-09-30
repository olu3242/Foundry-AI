"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Home, Settings, LogOut, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { NAV, type NavKey } from "./nav";
import { switchBusiness } from "./actions";

const ICONS: Record<NavKey, LucideIcon> = { today: Home, settings: Settings };

type Props = {
  businessId: string;
  businessName: string;
  businesses: { id: string; name: string }[];
  children: React.ReactNode;
};

export function AppShell({ businessId, businessName, businesses, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = `/b/${businessId}`;
  const isActive = (segment: string) =>
    segment === "" ? pathname === base : pathname === base + segment || pathname.startsWith(`${base + segment}/`);

  const links = NAV.map(({ key, label, segment }) => {
    const Icon = ICONS[key];
    return { key, label, href: base + segment, Icon, active: isActive(segment) };
  });

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-surface/40 p-5 backdrop-blur-xl md:flex">
        <Logo />
        <label className="sr-only" htmlFor="business-switcher">Current business</label>
        <select
          id="business-switcher"
          value={businessId}
          disabled={pending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(async () => {
              await switchBusiness(id);
              router.push(`/b/${id}`);
            });
          }}
          className="h-10 rounded-xl border bg-surface/60 px-3 text-sm font-medium"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <Link href="/onboarding" className="-mt-4 text-xs text-muted-foreground hover:text-foreground">+ Add a business</Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {links.map(({ key, label, href, Icon, active }) => (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted font-semibold text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post">
          <button className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/70 px-4 py-3 backdrop-blur-xl md:hidden">
          <Logo />
          <span className="max-w-[50%] truncate text-sm font-medium">{businessName}</span>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map(({ key, label, href, Icon, active }) => (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground", active && "text-growth")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

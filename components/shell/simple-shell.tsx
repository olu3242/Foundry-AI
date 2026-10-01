import Link from "next/link";
import { Logo } from "@/components/logo";

/** Chrome for pages outside a single business: programs and partner portfolio. */
export function SimpleShell({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center gap-4 py-3">
          <Link href="/app" aria-label="Foundry home"><Logo /></Link>
          <nav aria-label="Main" className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/app" className="hover:text-foreground">My business</Link>
            <Link href="/partner" className="hover:text-foreground">Portfolio</Link>
            <Link href="/programs" className="hover:text-foreground">Programs</Link>
            <Link href="/providers" className="hover:text-foreground">Providers</Link>
            {admin && <Link href="/admin/scale" className="hover:text-foreground">Admin</Link>}
            <form action="/auth/signout" method="post"><button className="hover:text-foreground">Sign out</button></form>
          </nav>
        </div>
      </header>
      <main id="main" className="container py-8">{children}</main>
    </div>
  );
}

import { CloudOff } from "lucide-react";
import { Logo } from "@/components/logo";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <Logo />
      <CloudOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">You’re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        Pages you opened recently still work. Anything you record is saved on this phone and sent when you’re back online.
      </p>
    </main>
  );
}

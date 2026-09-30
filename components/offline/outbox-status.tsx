"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushOutbox, listOutbox, OUTBOX_EVENT } from "@/lib/offline/outbox";
import { toast } from "@/components/toast";

/** Registers the service worker, shows queued captures, and syncs them when back online. */
export function OutboxStatus() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const refresh = () => listOutbox().then((i) => setPending(i.length)).catch(() => undefined);
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const { sent } = await flushOutbox();
      if (sent) {
        toast(`Sent ${sent} saved capture${sent > 1 ? "s" : ""}.`);
        router.refresh();
      }
    };
    refresh();
    sync();
    window.addEventListener(OUTBOX_EVENT, refresh);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    const id = setInterval(sync, 30_000);
    return () => {
      window.removeEventListener(OUTBOX_EVENT, refresh);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      clearInterval(id);
    };
  }, [router]);

  if (online && pending === 0) return null;
  return (
    <div role="status" className="flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold-ink">
      {online ? <RefreshCw className="size-3 animate-spin" aria-hidden /> : <CloudOff className="size-3" aria-hidden />}
      {online ? `Sending ${pending}…` : pending ? `Offline · ${pending} saved on this phone` : "Offline"}
    </div>
  );
}

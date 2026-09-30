"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders server data on an interval while `active` (e.g. captures still being read). */
export function AutoRefresh({ active, intervalMs = 2500, maxMs = 120_000 }: { active: boolean; intervalMs?: number; maxMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > maxMs || document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, maxMs, router]);
  return null;
}

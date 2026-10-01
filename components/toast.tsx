"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "error" };
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Fire-and-forget notice that outlives the component that raised it. */
export function toast(message: string, tone: Toast["tone"] = "success") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => (
        <div key={t.id} role="status" className="glass pointer-events-auto flex items-center gap-2 px-4 py-3 text-sm shadow-glow animate-in fade-in slide-in-from-bottom-2">
          {t.tone === "success" ? <CheckCircle2 className="size-4 text-growth" aria-hidden /> : <TriangleAlert className="size-4 text-orange-ink" aria-hidden />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

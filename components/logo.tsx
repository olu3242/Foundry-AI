import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7">
        <rect width="32" height="32" rx="9" fill="hsl(var(--brand))" />
        <path d="M10 23V9h12M10 16h8" stroke="hsl(var(--gold))" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </svg>
      <span>Foundry</span>
    </span>
  );
}

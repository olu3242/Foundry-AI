import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      brand: "border-growth/30 bg-growth/10 text-growth",
      opportunity: "border-gold/30 bg-gold/10 text-gold-ink",
      attention: "border-orange/30 bg-orange/10 text-orange-ink",
      trust: "border-navy/30 bg-navy/10 text-foreground",
      insight: "border-insight/30 bg-insight/10 text-insight",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

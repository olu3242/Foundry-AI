"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { batchAction } from "@/app/partner/actions";
import { cn } from "@/lib/utils";

export type QueueItem = { item_key: string; business_id: string; business_name: string; kind: string; severity: number; title: string; detail: string; since: string; link: string };

const tone = (s: number) => (s >= 65 ? "border-l-orange" : s >= 50 ? "border-l-gold" : "border-l-border");

export function AttentionQueue({ items }: { items: QueueItem[] }) {
  const [state, action, pending] = useActionState(batchAction, null);
  const [op, setOp] = useState<"snooze" | "nudge" | "done">("snooze");
  if (!items.length) return <p className="p-6 text-sm text-muted-foreground">Nothing needs you right now.</p>;
  return (
    <form action={action}>
      <ul className="divide-y" aria-label="Attention queue">
        {items.map((i) => (
          <li key={i.item_key} className={cn("flex items-start gap-3 border-l-4 p-4", tone(i.severity))}>
            <input type="checkbox" name="item" value={`${i.item_key}|${i.business_id}`} aria-label={`Select ${i.title} for ${i.business_name}`} className="mt-1 size-4" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{i.title} <span className="text-muted-foreground">· {i.business_name}</span></p>
              <p className="text-xs text-muted-foreground">{i.detail}</p>
            </div>
            <Link href={`/b/${i.business_id}${i.link}`} className="shrink-0 text-xs font-medium text-growth hover:underline">Open</Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t p-4">
        <Select name="op" aria-label="Batch action" value={op} onChange={(e) => setOp(e.target.value as "snooze" | "nudge" | "done")} className="h-9 w-44 text-xs">
          <option value="snooze">Snooze selected</option>
          <option value="nudge">Send a note to owners</option>
          <option value="done">Mark done (recovery / escalation)</option>
        </Select>
        {op === "snooze" ? (
          <Select name="days" aria-label="Snooze days" className="h-9 w-28 text-xs" defaultValue="3"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option></Select>
        ) : (
          <Input name="message" aria-label={op === "done" ? "What you did" : "Note to owners"} placeholder={op === "done" ? "e.g. Called the owner, helped enter last week" : "e.g. Remember to record today's sales"} className="h-9 flex-1 text-xs" />
        )}
        <Button size="sm" variant="outline" disabled={pending}>{op === "snooze" ? <BellOff /> : <Send />} Apply</Button>
        <div className="w-full"><FormMessage state={state} /></div>
      </div>
    </form>
  );
}

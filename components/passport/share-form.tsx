"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createShare } from "@/app/b/[bid]/passport/actions";

const SECTIONS = [
  { key: "summary", label: "Business summary" },
  { key: "track_record", label: "Monthly sales" },
  { key: "proof", label: "Proof and verifications" },
  { key: "pulse", label: "Pulse signals" },
];

export function ShareForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(createShare, null);
  const [copied, setCopied] = useState(false);
  const url = state?.ok ? state.data?.url : undefined;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Who is this for?</span>
        <Input name="label" required placeholder="e.g. Loan officer, Access Bank Ikeja" maxLength={80} /></Label>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">What they can see</legend>
        {SECTIONS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sections" value={s.key} defaultChecked={s.key !== "pulse"} className="size-4 accent-[hsl(var(--primary))]" /> {s.label}
          </label>
        ))}
      </fieldset>
      <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Link works for</span>
        <Select name="days" defaultValue="30"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></Select></Label>
      <Button disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Link2 />} Create link</Button>
      <FormMessage state={state} />
      {url && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/50 p-2">
          <code className="flex-1 truncate text-xs" data-testid="share-url">{url}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </form>
  );
}

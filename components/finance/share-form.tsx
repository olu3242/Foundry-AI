"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { sharePackage } from "@/app/b/[bid]/finance/actions";

const SECTIONS = [
  { key: "summary", label: "Business summary" }, { key: "track_record", label: "Monthly sales" },
  { key: "proof", label: "Proof, verifications and verified results" }, { key: "pulse", label: "Pulse signals" },
];

export function ShareEvidenceForm({ businessId, productId, currency, required }: { businessId: string; productId: string; currency: string; required: string[] }) {
  const [state, action, pending] = useActionState(sharePackage, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="productId" value={productId} />
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Amount ({currency})</span><Input name="amount" type="number" min="1" step="any" required /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">What it&apos;s for</span><Input name="purpose" required minLength={3} /></Label>
      <fieldset className="space-y-1 sm:col-span-2">
        <legend className="text-xs text-muted-foreground">What the partner will see (documents are never shared)</legend>
        {SECTIONS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sections" value={s.key} defaultChecked={required.includes(s.key)} disabled={required.includes(s.key)} className="size-4" />
            {s.label}{required.includes(s.key) && <span className="text-xs text-muted-foreground">(required by this partner)</span>}
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-1 size-4" />
        <span>I agree to share this snapshot with this partner for 90 days. I can withdraw it at any time.</span>
      </label>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Send />} Share evidence package</Button></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}

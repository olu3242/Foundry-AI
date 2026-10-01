"use client";

import { useActionState } from "react";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { startProviderSolution } from "@/app/b/[bid]/progress/actions";

export function StartProviderForm({ businessId, versionId, provider }: { businessId: string; versionId: string; provider: string }) {
  const [state, action, pending] = useActionState(startProviderSolution, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="max-w-xs space-y-2 text-xs">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="versionId" value={versionId} />
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4" />
        <span>I agree to work with {provider} and share this plan&apos;s progress and result with them (not my books).</span>
      </label>
      <Button size="sm" disabled={pending}><Handshake /> Start with {provider}</Button>
      <FormMessage state={state} />
    </form>
  );
}

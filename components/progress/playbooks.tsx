"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { launchPlaybook } from "@/app/b/[bid]/progress/actions";

export function LaunchPlaybook({ businessId, playbook }: { businessId: string; playbook: string }) {
  const [state, action, pending] = useActionState(launchPlaybook, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} /><input type="hidden" name="playbook" value={playbook} />
      <Button size="sm" disabled={pending}>Start playbook</Button>
      {state && !state.ok && <div className="mt-2"><FormMessage state={state} /></div>}
    </form>
  );
}

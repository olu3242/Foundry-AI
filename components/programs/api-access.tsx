"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createApiKey, createWebhook } from "@/app/programs/actions";

const SCOPES = ["businesses:read", "outcomes:read", "reports:read", "invitations:write", "events:subscribe"];
const EVENTS = ["intervention.started", "intervention.completed", "outcome.verified", "verification.attested", "sandbox.ping"];

function Secret({ value }: { value?: string }) {
  return value ? <code data-testid="shown-once" className="block break-all rounded-md bg-muted p-2 text-xs">{value}</code> : null;
}

export function CreateKeyForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(createApiKey, null);
  return (
    <form action={action} className="space-y-2 text-sm">
      <input type="hidden" name="programId" value={programId} />
      <Input name="name" aria-label="Key name" placeholder="e.g. CRM sync" required />
      <fieldset className="flex flex-wrap gap-3 text-xs">{SCOPES.map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" name="scopes" value={s} /> {s}</label>)}</fieldset>
      <Button size="sm" disabled={pending}>Create API key</Button>
      <FormMessage state={state} />
      <Secret value={state?.ok ? state.data?.key : undefined} />
    </form>
  );
}

export function CreateWebhookForm({ programId, identities }: { programId: string; identities: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createWebhook, null);
  if (!identities.length) return null;
  return (
    <form action={action} className="space-y-2 text-sm">
      <input type="hidden" name="programId" value={programId} />
      <Select name="identityId" aria-label="Webhook key">{identities.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
      <Input name="url" type="url" aria-label="Webhook URL" placeholder="https://your-system.example/foundry" required />
      <fieldset className="flex flex-wrap gap-3 text-xs">{EVENTS.map((e) => <label key={e} className="flex items-center gap-1"><input type="checkbox" name="events" value={e} /> {e}</label>)}</fieldset>
      <Button size="sm" variant="outline" disabled={pending}>Add webhook</Button>
      <FormMessage state={state} />
      <Secret value={state?.ok ? state.data?.key : undefined} />
    </form>
  );
}

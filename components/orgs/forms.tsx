"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createOrganization, orgAction } from "@/app/orgs/actions";

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganization, null);
  return (
    <form action={action} className="flex flex-wrap gap-2 text-sm">
      <Input name="name" aria-label="Organization name" placeholder="e.g. Example Bank" required className="w-64" />
      <Select name="kind" aria-label="Kind" className="w-40"><option value="bank">Bank</option><option value="ngo">NGO</option><option value="government">Government</option><option value="corporate">Corporate</option><option value="institution">Other</option></Select>
      <Button size="sm" disabled={pending}>Create organization</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}

/** One small form per org operation; the hidden "op" picks the RPC. */
export function OrgForm({ orgId, op, label, children }: { orgId: string; op: string; label: string; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(orgAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-xs" aria-label={label}>
      <input type="hidden" name="orgId" value={orgId} /><input type="hidden" name="op" value={op} />
      {children}
      <Button size="sm" variant="outline" disabled={pending}>{label}</Button>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}

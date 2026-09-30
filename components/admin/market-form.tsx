"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { saveMarket } from "@/app/admin/actions";

const F = ({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) => (
  <Label className="block space-y-1.5"><span className="block text-xs text-muted-foreground">{label}</span><Input name={name} placeholder={placeholder} required={required} /></Label>
);

/** B19: a new market is configuration. No code change, no fork. */
export function MarketForm() {
  const [state, action, pending] = useActionState(saveMarket, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <F label="Country code" name="country_code" placeholder="UG" required />
      <F label="Name" name="name" placeholder="Uganda" required />
      <F label="Currency" name="currency" placeholder="UGX" required />
      <F label="Timezone" name="default_timezone" placeholder="Africa/Kampala" required />
      <F label="Default language" name="default_locale" placeholder="en" />
      <F label="Languages (comma separated)" name="languages" placeholder="en, lg, sw" />
      <F label="Phone prefix" name="phone_prefix" placeholder="256" required />
      <F label="Mobile money (comma separated)" name="mobile_money" placeholder="MTN MoMo, Airtel Money" />
      <F label="Data residency" name="data_residency" placeholder="any" />
      <Label className="block space-y-1.5"><span className="block text-xs text-muted-foreground">Status</span>
        <Select name="status" defaultValue="beta"><option value="beta">beta</option><option value="active">active</option><option value="disabled">disabled</option></Select></Label>
      <Label className="block space-y-1.5 sm:col-span-3"><span className="block text-xs text-muted-foreground">Identifier types (JSON)</span>
        <Textarea name="identifier_types" rows={2} placeholder='[{"key":"ursb","label":"URSB registration","pattern":"^[0-9]{6,14}$"}]' /></Label>
      <div className="sm:col-span-3"><Button size="sm" disabled={pending}>Save market</Button> <FormMessage state={state} /></div>
    </form>
  );
}

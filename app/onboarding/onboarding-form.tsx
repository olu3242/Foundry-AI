"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { COUNTRIES, SECTORS } from "@/lib/auth/current-business";
import { createBusiness } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createBusiness, null);
  const [country, setCountry] = useState<string>(COUNTRIES[0].code);
  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={120} placeholder="Ama Provisions" />
        <FormMessage state={state} field="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sector">What do you do?</Label>
        <Select id="sector" name="sector" defaultValue="">
          <option value="">Choose one</option>
          {SECTORS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <input type="hidden" name="currency" value={selected.currency} />
      <input type="hidden" name="timezone" value={selected.timezone} />
      <p className="text-sm text-muted-foreground">Amounts will be kept in {selected.currency}.</p>
      <FormMessage state={state?.ok === false && !state.fieldErrors?.name ? state : null} />
      <Button className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Create my business
      </Button>
    </form>
  );
}

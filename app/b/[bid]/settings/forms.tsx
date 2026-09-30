"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { SECTORS } from "@/lib/auth/current-business";
import { addMember, updateBusiness } from "./actions";

export function BusinessForm({ businessId, name, sector, canEdit }: { businessId: string; name: string; sector: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(updateBusiness, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      <fieldset disabled={!canEdit || pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sector">Sector</Label>
          <Select id="sector" name="sector" defaultValue={sector ?? ""}>
            <option value="">Not set</option>
            {SECTORS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        {canEdit && <Button size="sm">Save</Button>}
      </fieldset>
      <FormMessage state={state} />
    </form>
  );
}

export function AddMemberForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(addMember, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="space-y-2">
        <Label htmlFor="contact">Phone or email</Label>
        <Input id="contact" name="contact" required placeholder="+234 800 000 0002" />
      </div>
      <Select name="role" aria-label="Role" defaultValue="staff">
        <option value="staff">Staff</option>
        <option value="owner">Owner</option>
        <option value="partner">Business partner</option>
      </Select>
      <Button size="sm" disabled={pending}>Add</Button>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

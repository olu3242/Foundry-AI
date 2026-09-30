"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { addProgramMember, createProgram, inviteBusinesses, updateProgram } from "@/app/programs/actions";

export function CreateProgramForm() {
  const [state, action, pending] = useActionState(createProgram, null);
  return (
    <form action={action} className="grid gap-3">
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Program name</span><Input name="name" required minLength={3} placeholder="Accra Retail Accelerator 2026" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Sponsor (optional)</span><Input name="sponsor" placeholder="Bank, agency or foundation" /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">What it offers (optional)</span><Textarea name="description" maxLength={2000} /></Label>
      <Button disabled={pending}>{pending && <Loader2 className="animate-spin" />} Create program</Button>
      <FormMessage state={state} />
    </form>
  );
}

export function AddMemberForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(addProgramMember, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <input type="hidden" name="programId" value={programId} />
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Phone or email</span><Input name="contact" required /></Label>
      <Select name="role" aria-label="Role" defaultValue="partner"><option value="partner">Business partner</option><option value="admin">Admin</option></Select>
      <Button size="sm" disabled={pending}>Add</Button>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function InviteForm({ programId }: { programId: string }) {
  const [state, action, pending] = useActionState(inviteBusinesses, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="programId" value={programId} />
      <Label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Phone numbers or emails (one per line)</span>
        <Textarea name="contacts" rows={4} placeholder={"+233 20 000 0001\nowner@example.com"} /></Label>
      <Button size="sm" disabled={pending}>Invite</Button>
      <FormMessage state={state} />
    </form>
  );
}

type ProgramSettings = { id: string; kind: string; phase: string; countries: string[]; sectors: string[]; goals: string | null; target_businesses: number | null };

export function ProgramSettingsForm({ program }: { program: ProgramSettings }) {
  const [state, action, pending] = useActionState(updateProgram, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="programId" value={program.id} />
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Type</span>
        <Select name="kind" defaultValue={program.kind}>{["accelerator", "lender", "agency", "supplier", "other"].map((k) => <option key={k}>{k}</option>)}</Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Stage</span>
        <Select name="phase" defaultValue={program.phase}>{["setup", "recruiting", "active", "completed"].map((k) => <option key={k}>{k}</option>)}</Select></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Countries (codes, comma separated)</span><Input name="countries" defaultValue={program.countries.join(", ")} /></Label>
      <Label className="space-y-1.5"><span className="block text-xs text-muted-foreground">Target businesses</span><Input name="target" type="number" min={1} defaultValue={program.target_businesses ?? ""} /></Label>
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">Sectors (comma separated)</span><Input name="sectors" defaultValue={program.sectors.join(", ")} /></Label>
      <Label className="space-y-1.5 sm:col-span-2"><span className="block text-xs text-muted-foreground">Goals</span><Textarea name="goals" defaultValue={program.goals ?? ""} /></Label>
      <div className="sm:col-span-2"><Button size="sm" disabled={pending}>Save settings</Button> <FormMessage state={state} /></div>
    </form>
  );
}

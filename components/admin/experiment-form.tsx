"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createExperiment } from "@/app/admin/actions";

type Sol = { id: string; name: string; versions: { id: string; version: number }[] };

export function ExperimentForm({ solutions }: { solutions: Sol[] }) {
  const [state, action, pending] = useActionState(createExperiment, null);
  const [sid, setSid] = useState(solutions[0]?.id ?? "");
  const versions = solutions.find((s) => s.id === sid)?.versions ?? [];
  return (
    <form action={action} className="grid gap-2 text-sm sm:grid-cols-2">
      <Input name="key" aria-label="Experiment key" placeholder="whatsapp_step" required />
      <Input name="name" aria-label="Experiment name" placeholder="WhatsApp step" required />
      <Input name="hypothesis" aria-label="Hypothesis" placeholder="Adding a WhatsApp step improves results" required className="sm:col-span-2" />
      <Select name="solutionId" aria-label="Solution" value={sid} onChange={(e) => setSid(e.target.value)}>{solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      <div className="flex gap-2">
        <Select name="control" aria-label="Control version">{versions.map((v) => <option key={v.id} value={v.id}>control: v{v.version}</option>)}</Select>
        <Select name="treatment" aria-label="Treatment version" defaultValue={versions.at(-1)?.id}>{versions.map((v) => <option key={v.id} value={v.id}>treatment: v{v.version}</option>)}</Select>
      </div>
      <Input name="controlWeight" type="number" min={0} max={100} defaultValue={50} aria-label="Control share (%)" />
      <Select name="metric" aria-label="Primary metric"><option value="improved_rate">Improved rate</option><option value="completion_rate">Completion rate</option></Select>
      <Input name="minPerArm" type="number" min={5} defaultValue={30} aria-label="Minimum plans per arm" />
      <Input name="maxDays" type="number" min={7} max={365} defaultValue={90} aria-label="Maximum days" />
      <Input name="abandonMax" type="number" step="0.05" min={0} max={1} defaultValue={0.5} aria-label="Stop if treatment abandon rate exceeds" />
      <Button size="sm" disabled={pending}>Create experiment</Button>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}

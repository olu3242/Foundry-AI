"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/form-message";
import { createExperiment } from "@/app/admin/actions";
import { planBinaryExperiment } from "@/lib/experiments/planner";

type Sol = { id: string; name: string; versions: { id: string; version: number }[] };

export function ExperimentForm({ solutions }: { solutions: Sol[] }) {
  const [state, action, pending] = useActionState(createExperiment, null);
  const [sid, setSid] = useState(solutions[0]?.id ?? "");
  const [baselineRate, setBaselineRate] = useState(30);
  const [lift, setLift] = useState(15);
  const versions = solutions.find((s) => s.id === sid)?.versions ?? [];
  const plan = useMemo(() => {
    try {
      return planBinaryExperiment({ baselineRate: baselineRate / 100, minimumDetectableLift: lift / 100 });
    } catch {
      return null;
    }
  }, [baselineRate, lift]);
  return (
    <form action={action} className="grid gap-2 text-sm sm:grid-cols-2">
      <Input name="key" aria-label="Experiment key" placeholder="whatsapp_step" required />
      <Input name="name" aria-label="Experiment name" placeholder="WhatsApp step" required />
      <Input name="hypothesis" aria-label="Hypothesis" placeholder="Adding a WhatsApp step improves results" required className="sm:col-span-2" />
      <Select name="solutionId" aria-label="Solution" value={sid} onChange={(e) => setSid(e.target.value)}>{solutions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      <div className="flex gap-2">
        <Select key={`c-${sid}`} name="control" aria-label="Control version">{versions.map((v) => <option key={v.id} value={v.id}>control: v{v.version}</option>)}</Select>
        <Select key={`t-${sid}`} name="treatment" aria-label="Treatment version" defaultValue={versions.at(-1)?.id}>{versions.map((v) => <option key={v.id} value={v.id}>treatment: v{v.version}</option>)}</Select>
      </div>
      <Input name="controlWeight" type="number" min={0} max={100} defaultValue={50} aria-label="Control share (%)" />
      <Select name="metric" aria-label="Primary metric"><option value="improved_rate">Improved rate</option><option value="completion_rate">Completion rate</option></Select>
      <Input type="number" min={1} max={99} value={baselineRate} onChange={(e) => setBaselineRate(Number(e.target.value))} aria-label="Expected baseline rate (%)" />
      <Input type="number" min={1} max={99} value={lift} onChange={(e) => setLift(Number(e.target.value))} aria-label="Minimum detectable lift (percentage points)" />
      <Input name="minPerArm" type="number" min={5} defaultValue={plan?.perArm ?? 30} key={plan?.perArm ?? 30} aria-label="Minimum plans per arm" />
      <p className="text-xs text-muted-foreground sm:col-span-2">{plan ? `Planning guide: about ${plan.perArm} completed plans per arm (${plan.total} total) for 80% power at 5% significance, assuming ${baselineRate}% baseline and a ${lift}-point lift.` : "Enter a valid baseline rate and detectable lift."}</p>
      <Input name="maxDays" type="number" min={7} max={365} defaultValue={90} aria-label="Maximum days" />
      <Input name="abandonMax" type="number" step="0.05" min={0} max={1} defaultValue={0.5} aria-label="Stop if treatment abandon rate exceeds" />
      <Button size="sm" disabled={pending}>Create experiment</Button>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}

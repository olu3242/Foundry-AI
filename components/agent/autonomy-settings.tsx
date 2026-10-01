"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { ACTION_TYPES, LEVELS, effectiveLevel, type ActionType } from "@/lib/autonomy/policy";
import { setAutonomy } from "@/app/b/[bid]/settings/actions";

export function AutonomySettings({ businessId, policies, canEdit }: { businessId: string; policies: Record<string, number>; canEdit: boolean }) {
  return (
    <ul className="divide-y">
      {(Object.keys(ACTION_TYPES) as ActionType[]).map((type) => (
        <AutonomyRow key={type} businessId={businessId} type={type} level={effectiveLevel(type, policies[type])} canEdit={canEdit} />
      ))}
    </ul>
  );
}

function AutonomyRow({ businessId, type, level, canEdit }: { businessId: string; type: ActionType; level: number; canEdit: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const meta = ACTION_TYPES[type];
  return (
    <li className="grid gap-2 py-4 sm:grid-cols-[1fr_220px] sm:items-center">
      <div>
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
        <p className="mt-1 text-xs text-insight">{LEVELS[level]?.description}</p>
      </div>
      <form ref={form} action={setAutonomy}>
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="actionType" value={type} />
        <Select name="level" aria-label={`${meta.label} autonomy`} defaultValue={level} disabled={!canEdit} onChange={() => form.current?.requestSubmit()}>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level} disabled={l.level > meta.maxLevel}>
              L{l.level} · {l.label}{l.level > meta.maxLevel ? " (not available yet)" : ""}
            </option>
          ))}
        </Select>
      </form>
    </li>
  );
}

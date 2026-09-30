import type { ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function FormMessage({ state, field }: { state: ActionState; field?: string }) {
  if (!state) return null;
  const fieldError = !state.ok && field ? state.fieldErrors?.[field]?.[0] : undefined;
  const message = fieldError ?? (state.ok ? state.message : state.error);
  if (!message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-growth" : "text-destructive")}>
      {message}
    </p>
  );
}

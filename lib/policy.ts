import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * B28: evaluates (and records) a policy before a governed write, so denials are logged and the
 * user sees the policy's reason. The database trigger enforces the same policy as a hard guard.
 */
export async function policyDenial(supabase: ServerSupabase, key: "solution.start" | "finance.evidence_share" | "partner.verify_outcome",
  businessId: string, params: Record<string, string | number | undefined> = {}): Promise<string | null> {
  const { data, error } = await supabase.rpc("check_policy", { p_key: key, p_business_id: businessId, p_params: params });
  if (error) return null; // the trigger still enforces
  const d = data as { result: string; reasons: string[] };
  return d.result === "deny" ? (d.reasons[0] ?? "Not allowed by your program or market rules.") : null;
}

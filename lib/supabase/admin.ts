import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

let admin: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client. Bypasses RLS: use only in workers, webhooks and public
 * share pages, and always scope queries by business_id explicitly.
 */
export function createAdminClient() {
  admin ??= createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export type AdminSupabase = ReturnType<typeof createAdminClient>;

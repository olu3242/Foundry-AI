import type { AdminSupabase } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];

export type JobContext = { job: Job; admin: AdminSupabase; signal: AbortSignal };
export type JobHandler = (ctx: JobContext) => Promise<Json | void>;

/** Throw for failures a retry cannot fix (bad payload, deleted entity). Goes straight to dead. */
export class PermanentJobError extends Error {}

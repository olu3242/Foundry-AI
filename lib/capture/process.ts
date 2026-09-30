import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runJobNow } from "@/lib/jobs/runner";

/** Runs the extraction job right after the response is sent; the cron worker is the safety net. */
export function processCaptureSoon(captureId: string) {
  after(async () => {
    const { data } = await createAdminClient()
      .from("jobs")
      .select("id")
      .eq("dedupe_key", `capture:${captureId}`)
      .eq("status", "queued")
      .maybeSingle();
    if (data) await runJobNow(data.id);
  });
}

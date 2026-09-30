import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { getAnthropic } from "@/lib/ai/client";
import { extractRecords, type ExtractionResult } from "@/lib/ai/extract";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { toDrafts } from "@/lib/ai/map";
import type { Json } from "@/lib/supabase/database.types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export const extractCapture: JobHandler = async ({ job, admin }) => {
  const captureId = (job.payload as { capture_id?: string }).capture_id;
  if (!captureId) throw new PermanentJobError("payload.capture_id missing");

  const { data: capture } = await admin.from("captures").select("*").eq("id", captureId).maybeSingle();
  if (!capture) throw new PermanentJobError("capture not found");
  if (capture.status === "drafted" || capture.status === "resolved") return { skipped: capture.status };

  const markFailed = async (error: string) => {
    await admin.from("captures").update({ status: "failed", error, processed_at: new Date().toISOString() }).eq("id", capture.id);
    await admin.from("events").insert({ business_id: capture.business_id, type: "capture.failed", actor_type: "agent", entity_type: "capture", entity_id: capture.id, payload: { error } });
  };

  await admin.from("captures").update({ status: "processing", error: null }).eq("id", capture.id);

  const [{ data: business }, { data: products }, { data: customers }] = await Promise.all([
    admin.from("businesses").select("currency, timezone").eq("id", capture.business_id).single(),
    admin.from("products").select("name").eq("business_id", capture.business_id).order("updated_at", { ascending: false }).limit(50),
    admin.from("customers").select("name").eq("business_id", capture.business_id).order("updated_at", { ascending: false }).limit(50),
  ]);
  if (!business) throw new PermanentJobError("business not found");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(new Date());

  let image: { base64: string; mediaType: ImageType } | null = null;
  if (capture.storage_path) {
    const { data: blob, error } = await admin.storage.from("captures").download(capture.storage_path);
    if (error || !blob) throw new Error(`photo download failed: ${error?.message ?? "empty"}`);
    const mediaType = (IMAGE_TYPES as readonly string[]).includes(capture.mime_type ?? "") ? (capture.mime_type as ImageType) : "image/jpeg";
    image = { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), mediaType };
  }

  const started = Date.now();
  let result: ExtractionResult;
  try {
    if (getAnthropic()) {
      result = await extractRecords({
        text: capture.raw_text,
        image,
        currency: business.currency,
        today,
        knownProducts: (products ?? []).map((p) => p.name),
        knownCustomers: (customers ?? []).map((c) => c.name),
      });
    } else if (process.env.NODE_ENV !== "production" && capture.raw_text) {
      result = { ok: true, extraction: heuristicExtract(capture.raw_text), model: "heuristic-dev", usage: { input: 0, output: 0 } };
    } else {
      await markFailed("Automatic reading isn't available right now. Please enter this record by hand.");
      throw new PermanentJobError("AI extraction not configured");
    }
  } catch (error) {
    if (!(error instanceof PermanentJobError) && job.attempts >= job.max_attempts) {
      await markFailed("We couldn't read this after several tries. Please enter it by hand.");
    }
    throw error;
  }

  const drafted = result.ok ? toDrafts(result.extraction.records, business.currency) : { drafts: [], rejected: [] };
  const { data: run } = await admin
    .from("agent_runs")
    .insert({
      business_id: capture.business_id,
      agent: "capture-extractor",
      trigger: `job:${job.id}`,
      subject_type: "capture",
      subject_id: capture.id,
      model: result.model,
      status: result.ok ? "succeeded" : result.reason === "refused" ? "refused" : "failed",
      output: (result.ok ? { ...result.extraction, rejected: drafted.rejected } : { reason: result.reason, detail: result.detail }) as Json,
      input_tokens: result.usage.input,
      output_tokens: result.usage.output,
      latency_ms: Date.now() - started,
    })
    .select("id")
    .single();

  if (!result.ok) {
    await markFailed(
      result.reason === "refused"
        ? "This capture couldn't be processed automatically. Please enter it by hand."
        : "We couldn't read this one. Try rephrasing, or enter it by hand.",
    );
    throw new PermanentJobError(`extraction ${result.reason}`);
  }

  if (!drafted.drafts.length) {
    await markFailed(result.extraction.note_for_user ?? "We didn't find a sale, expense or stock change in that.");
    return { drafts: 0 };
  }

  const { error: insertError } = await admin.from("record_drafts").insert(
    drafted.drafts.map((d) => ({
      business_id: capture.business_id,
      capture_id: capture.id,
      agent_run_id: run?.id ?? null,
      kind: d.kind,
      fields: d.fields as { [key: string]: Json },
      confidence: d.confidence,
      evidence: d.evidence as Json[],
      explanation: d.explanation,
    })),
  );
  if (insertError) throw insertError;

  await admin.from("captures").update({ status: "drafted", processed_at: new Date().toISOString() }).eq("id", capture.id);
  await admin.from("events").insert({
    business_id: capture.business_id,
    type: "capture.drafted",
    actor_type: "agent",
    entity_type: "capture",
    entity_id: capture.id,
    payload: { drafts: drafted.drafts.length, kinds: drafted.drafts.map((d) => d.kind) },
  });
  return { drafts: drafted.drafts.length, agent_run_id: run?.id ?? null };
};

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { billingConfigured, getStripe } from "@/lib/billing/stripe";
import { publicEnv, serverEnv } from "@/lib/env";
import { toMinor } from "@/lib/money";

export async function createProgram(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/programs");
  const parsed = z.object({
    name: z.string().trim().min(3).max(120), sponsor: z.string().trim().max(120).optional(), description: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Give the program a name (3+ characters).");
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_program", {
    p_name: parsed.data.name, p_sponsor_name: parsed.data.sponsor, p_description: parsed.data.description,
  });
  if (error || !id) return fail(error ? friendlyDbError(error) : "Could not create the program.");
  redirect(`/programs/${id}`);
}

export async function addProgramMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const { programId, contact, role } = z.object({ programId: z.uuid(), contact: z.string().trim().min(5), role: z.enum(["admin", "partner"]) }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_program_member", { p_program_id: programId, p_contact: contact, p_role: role });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${programId}`);
  return { ok: true, message: "Added." };
}

export async function assignPartner(formData: FormData) {
  const { programId, partnerId, businessId } = z.object({ programId: z.uuid(), partnerId: z.uuid(), businessId: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("assign_partner", { p_program_id: programId, p_partner_user_id: partnerId, p_business_id: businessId });
  revalidatePath(`/programs/${programId}`);
}

export async function startCheckout(formData: FormData) {
  const programId = z.uuid().parse(formData.get("programId"));
  const user = await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, name, seats, stripe_customer_id").eq("id", programId).maybeSingle();
  const { data: me } = await supabase.from("program_members").select("role").eq("program_id", programId).eq("user_id", user.id).maybeSingle();
  if (!program || me?.role !== "admin" || !billingConfigured()) redirect(`/programs/${programId}?billing=unavailable`);

  const session = await getStripe()!.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: serverEnv().STRIPE_PROGRAM_PRICE_ID!, quantity: program.seats }],
    customer: program.stripe_customer_id ?? undefined,
    customer_email: program.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: program.id,
    metadata: { program_id: program.id },
    subscription_data: { metadata: { program_id: program.id } },
    success_url: new URL(`/programs/${program.id}?billing=success`, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    cancel_url: new URL(`/programs/${program.id}?billing=cancelled`, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
  }, { idempotencyKey: `checkout:${program.id}:${program.seats}:${new Date().toISOString().slice(0, 13)}` });
  redirect(session.url!);
}

export async function inviteBusinesses(_: ActionState, formData: FormData): Promise<ActionState> {
  const programId = z.uuid().parse(formData.get("programId"));
  await requireUser(`/programs/${programId}`);
  const contacts = String(formData.get("contacts") ?? "").split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean);
  if (!contacts.length) return fail("Paste phone numbers or emails, one per line.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bulk_invite", { p_program_id: programId, p_contacts: contacts });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${programId}`);
  return { ok: true, message: `${data ?? 0} new invitation(s). Share the join link with them.` };
}

export async function updateProgram(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    programId: z.uuid(), kind: z.enum(["accelerator", "lender", "agency", "supplier", "other"]),
    phase: z.enum(["setup", "recruiting", "active", "completed"]),
    countries: z.string().optional(), sectors: z.string().optional(), goals: z.string().max(2000).optional(),
    target: z.coerce.number().int().min(1).optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail("Please check the program settings.");
  const p = parsed.data;
  await requireUser(`/programs/${p.programId}`);
  const supabase = await createClient();
  const list = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const { error } = await supabase.from("programs").update({
    kind: p.kind, phase: p.phase, countries: list(p.countries).map((c) => c.toUpperCase()), sectors: list(p.sectors),
    goals: p.goals ?? null, target_businesses: p.target ?? null,
  }).eq("id", p.programId);
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${p.programId}`);
  return { ok: true, message: "Saved." };
}

export async function createProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    programId: z.uuid(), name: z.string().trim().min(3).max(120),
    productType: z.enum(["working_capital", "stock_financing", "equipment", "invoice_financing", "grant", "other"]),
    currency: z.string().regex(/^[A-Za-z]{3}$/), min: z.coerce.number().min(0), max: z.coerce.number().positive(),
    minMonths: z.coerce.number().int().min(0).max(36).default(0),
    minProof: z.enum(["self_reported", "document_backed", "third_party_verified", "institution_verified"]),
    minVerified: z.coerce.number().int().min(0).max(20).default(0), countries: z.string().optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail("Please check the product details.");
  const p = parsed.data;
  await requireUser(`/programs/${p.programId}`);
  const supabase = await createClient();
  const cur = p.currency.toUpperCase();
  const countries = (p.countries ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const { error } = await supabase.rpc("create_financial_product", {
    p_program_id: p.programId, p_name: p.name, p_product_type: p.productType, p_currency: cur,
    p_min: toMinor(p.min, cur), p_max: toMinor(p.max, cur),
    p_eligibility: { min_months_records: p.minMonths, min_proof_level: p.minProof, ...(p.minVerified ? { min_verified_outcomes: p.minVerified } : {}), ...(countries.length ? { countries } : {}) },
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${p.programId}`);
  return { ok: true, message: "Listed. Eligible businesses can now share evidence with you." };
}

export async function decidePackage(formData: FormData) {
  const { programId, id, status, note } = z.object({
    programId: z.uuid(), id: z.uuid(), status: z.enum(["under_review", "approved", "declined"]), note: z.string().max(1000).optional(),
  }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("decide_evidence_package", { p_package_id: id, p_status: status, p_note: note || undefined });
  revalidatePath(`/programs/${programId}`);
}

// B21: sponsor a plan for every consenting business in the program ("" ends sponsorship).
export async function sponsorPlan(formData: FormData) {
  const { programId, plan } = z.object({ programId: z.uuid(), plan: z.string().max(40) }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("sponsor_plan", { p_program_id: programId, p_plan_key: plan || (null as unknown as string) });
  revalidatePath(`/programs/${programId}`);
}

// B23: program-level routing authority and undo of automated steps.
export async function setAutoRoute(formData: FormData) {
  const { programId, on } = z.object({ programId: z.uuid(), on: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("set_program_auto_route", { p_program_id: programId, p_on: on === "true" });
  revalidatePath(`/programs/${programId}`);
}

export async function revertAutomation(formData: FormData) {
  const { programId, actionId } = z.object({ programId: z.uuid(), actionId: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("revert_ops_action", { p_action_id: actionId });
  revalidatePath(`/programs/${programId}`);
}

// ─── B27 API platform ─────────────────────────────────────────────────────────
const SCOPES = ["businesses:read", "outcomes:read", "reports:read", "invitations:write", "events:subscribe"] as const;

export async function createApiKey(_: ActionState, formData: FormData): Promise<ActionState<{ key: string }>> {
  const parsed = z.object({ programId: z.uuid(), name: z.string().trim().min(2).max(80) }).safeParse(Object.fromEntries(formData));
  const scopes = formData.getAll("scopes").map(String).filter((s): s is (typeof SCOPES)[number] => (SCOPES as readonly string[]).includes(s));
  if (!parsed.success || !scopes.length) return fail("Name the key and choose at least one permission.");
  await requireUser(`/programs/${parsed.data.programId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_service_identity", { p_program_id: parsed.data.programId, p_name: parsed.data.name, p_scopes: scopes });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${parsed.data.programId}`);
  return { ok: true, data: { key: (data as { key: string }).key }, message: "Copy this key now. It won't be shown again." };
}

export async function revokeApiKey(formData: FormData) {
  const { programId, id } = z.object({ programId: z.uuid(), id: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("revoke_service_identity", { p_identity_id: id });
  revalidatePath(`/programs/${programId}`);
}

export async function createWebhook(_: ActionState, formData: FormData): Promise<ActionState<{ key: string }>> {
  const parsed = z.object({ programId: z.uuid(), identityId: z.uuid(), url: z.url().max(500) }).safeParse(Object.fromEntries(formData));
  const events = formData.getAll("events").map(String);
  if (!parsed.success || !events.length) return fail("Choose a key, a URL and at least one event.");
  await requireUser(`/programs/${parsed.data.programId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_webhook_subscription", { p_identity_id: parsed.data.identityId, p_url: parsed.data.url, p_event_types: events });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${parsed.data.programId}`);
  return { ok: true, data: { key: (data as { secret: string }).secret }, message: "Signing secret (shown once):" };
}

export async function createSandbox(formData: FormData) {
  const { programId } = z.object({ programId: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("create_sandbox_program", { p_program_id: programId });
  if (data) redirect(`/programs/${data}`);
}

// B36: documented partner capabilities (used by routing).
export async function setCapabilities(formData: FormData) {
  const { programId, userId } = z.object({ programId: z.uuid(), userId: z.uuid() }).parse(Object.fromEntries(formData));
  const caps = formData.getAll("capabilities").map(String);
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("set_partner_capabilities", { p_program_id: programId, p_user_id: userId, p_capabilities: caps });
  revalidatePath(`/programs/${programId}`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

export async function createOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ name: z.string().trim().min(3).max(120), kind: z.enum(["bank", "ngo", "government", "corporate", "institution"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Name the organization.");
  await requireUser("/orgs");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: parsed.data.name, p_kind: parsed.data.kind });
  if (error) return fail(friendlyDbError(error));
  redirect(`/orgs/${data}`);
}

async function orgCall(oid: string, fn: (s: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<ActionState> {
  await requireUser(`/orgs/${oid}`);
  const { error } = await fn(await createClient());
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/orgs/${oid}`);
  return { ok: true, message: "Done." };
}

export async function orgAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const f = Object.fromEntries(formData) as Record<string, string>;
  const oid = z.uuid().parse(f.orgId);
  switch (f.op) {
    case "attach": return orgCall(oid, (s) => s.rpc("attach_program", { p_org_id: oid, p_program_id: z.uuid().parse(f.programId) }));
    case "member": return orgCall(oid, (s) => s.rpc("add_org_member", { p_org_id: oid, p_contact: f.contact ?? "", p_role: z.enum(["admin", "analyst", "auditor"]).parse(f.role) }));
    case "delegate": return orgCall(oid, (s) => s.rpc("delegate_program_role", { p_org_id: oid, p_program_id: z.uuid().parse(f.programId), p_contact: f.contact ?? "",
      p_role: z.enum(["admin", "partner"]).parse(f.role) }));
    case "sponsor": return orgCall(oid, (s) => s.rpc("org_sponsor_plan", { p_org_id: oid, p_plan_key: f.plan || (null as unknown as string) }));
    case "sla": return orgCall(oid, (s) => s.rpc("set_org_sla", { p_org_id: oid, p_sla: { verify_hours: Number(f.verify_hours), escalation_hours: Number(f.escalation_hours) } }));
    default: return fail("Unknown action.");
  }
}

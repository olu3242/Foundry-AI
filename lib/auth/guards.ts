import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type BusinessRole = Database["public"]["Enums"]["business_role"];
export const WRITER_ROLES: BusinessRole[] = ["owner", "staff"];

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser(next = "/app") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Loads a business the current user belongs to. 404s (not 403s) to avoid leaking existence. */
export const requireBusiness = cache(async (businessId: string, roles?: BusinessRole[]) => {
  const user = await requireUser(`/b/${businessId}`);
  const supabase = await createClient();
  const [{ data: business }, { data: membership }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    supabase.from("memberships").select("role").eq("business_id", businessId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!business || !membership) notFound();
  if (roles && !roles.includes(membership.role)) notFound();
  return { user, business, role: membership.role, supabase };
});

export function safeNext(next: string | null | undefined, fallback = "/app") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

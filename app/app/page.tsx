import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_BUSINESS_COOKIE } from "@/lib/auth/current-business";

/** Entry point after sign-in: go to the last business used, else the first, else onboarding. */
export default async function AppEntry() {
  const user = await requireUser("/app");
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("business_id, role")
    .eq("user_id", user.id)
    .order("created_at");
  if (!memberships?.length) {
    const { count } = await supabase.from("program_members").select("program_id", { count: "exact", head: true }).eq("user_id", user.id);
    redirect(count ? "/partner" : "/onboarding");
  }
  const last = (await cookies()).get(CURRENT_BUSINESS_COOKIE)?.value;
  const target = memberships.find((m) => m.business_id === last) ?? memberships[0]!;
  redirect(`/b/${target.business_id}`);
}

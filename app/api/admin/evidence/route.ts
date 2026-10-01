import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEvidencePack } from "@/lib/evidence";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("am_platform_admin");
  if (!isAdmin) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pack = await buildEvidencePack(supabase);
  return NextResponse.json(pack, { headers: { "content-disposition": `attachment; filename="foundry-evidence-${pack.generated_at.slice(0, 10)}.json"` } });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Flattened aggregate report for sponsors. No business identities. */
export async function GET(_: Request, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("program_report", { p_program_id: pid });
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rows: [string, string][] = [];
  const walk = (prefix: string, v: unknown) => {
    if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(prefix ? `${prefix}.${k}` : k, x));
    else rows.push([prefix, v === null ? "" : String(v)]);
  };
  walk("", data);
  const csv = ["metric,value", ...rows.map(([k, v]) => `${k},${v.includes(",") ? `"${v}"` : v}`)].join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="program-${pid}.csv"` } });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configIssues, isProduction } from "@/lib/config-check";

export const dynamic = "force-dynamic";

/** Liveness + queue health for uptime monitors. No business data. */
export async function GET() {
  const started = Date.now();
  try {
    const admin = createAdminClient();
    const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const [db, queued, stale, dead] = await Promise.all([
      admin.from("businesses").select("id", { head: true, count: "exact" }).limit(1),
      admin.from("jobs").select("id", { head: true, count: "exact" }).eq("status", "queued").lte("run_at", new Date().toISOString()),
      admin.from("jobs").select("id", { head: true, count: "exact" }).eq("status", "queued").lt("run_at", staleCutoff),
      admin.from("jobs").select("id", { head: true, count: "exact" }).eq("status", "dead").gte("finished_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);
    if (db.error) throw db.error;
    // B41: configuration codes only (never values); enforced in production, informational elsewhere.
    const issues = configIssues(process.env).map((i) => i.code);
    const body = {
      ok: (stale.count ?? 0) === 0 && (!isProduction(process.env) || issues.length === 0),
      config: { production: isProduction(process.env), issues: isProduction(process.env) ? issues : issues.length },
      db_ms: Date.now() - started,
      queue: { ready: queued.count ?? 0, overdue_10m: stale.count ?? 0, dead_24h: dead.count ?? 0 },
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    };
    return NextResponse.json(body, { status: body.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}

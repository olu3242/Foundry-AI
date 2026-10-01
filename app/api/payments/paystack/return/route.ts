import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAndApply } from "@/lib/payments/apply";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

/** Checkout return: ask Paystack for the truth (never trust the query string), then back to the plan page. */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref") ?? "";
  const admin = createAdminClient();
  const { data: pr } = await admin.from("payment_requests").select("business_id").eq("reference", reference).maybeSingle();
  if (!pr) return NextResponse.redirect(new URL("/app", request.url));
  let outcome = "pending";
  try {
    outcome = await verifyAndApply(admin, reference);
  } catch (error) {
    reportError(error, { msg: "paystack.return.verify_failed" });   // the hourly reconcile job retries
  }
  const url = new URL(`/b/${pr.business_id}/plan`, request.url);
  url.searchParams.set("payment", outcome === "succeeded" ? "paid" : outcome);
  return NextResponse.redirect(url);
}

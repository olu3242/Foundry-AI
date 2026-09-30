import { NextResponse } from "next/server";
import { API_VERSION } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

/** API index: version and endpoints. Authenticated endpoints need `Authorization: Bearer fdy_…`. */
export function GET() {
  return NextResponse.json({
    version: API_VERSION,
    endpoints: [
      { method: "GET", path: "/api/v1/businesses", scope: "businesses:read", description: "Consenting businesses enrolled in your program" },
      { method: "GET", path: "/api/v1/businesses/{id}/outcomes", scope: "outcomes:read", description: "Plan results for one enrolled business" },
      { method: "GET", path: "/api/v1/report", scope: "reports:read", description: "Aggregated program report (small groups suppressed)" },
      { method: "POST", path: "/api/v1/invitations", scope: "invitations:write", description: "Invite up to 500 contacts: { contacts: string[] }" },
      { method: "POST", path: "/api/v1/webhooks/test", scope: "events:subscribe", description: "Send sandbox.ping to your subscriptions" },
    ],
    webhooks: { signature_header: "Foundry-Signature", scheme: "t=<unix>,v1=<hex hmac-sha256 of `${t}.${body}` with your secret>",
      events: ["intervention.started", "intervention.completed", "outcome.verified", "verification.attested", "sandbox.ping"] },
  }, { headers: { "Foundry-API-Version": API_VERSION } });
}

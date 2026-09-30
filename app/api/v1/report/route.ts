import { unwrap, withApi } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

export const GET = withApi("reports:read", async ({ identity, admin }) =>
  unwrap(await admin.rpc("api_program_report", { p_identity_id: identity.id })));

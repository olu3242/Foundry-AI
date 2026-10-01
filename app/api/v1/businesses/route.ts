import { unwrap, withApi } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

export const GET = withApi("businesses:read", async ({ identity, admin }) =>
  unwrap(await admin.rpc("api_list_businesses", { p_identity_id: identity.id })));

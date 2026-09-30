import { z } from "zod";
import { ApiError, unwrap, withApi } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

export const GET = withApi<{ id: string }>("outcomes:read", async ({ identity, admin, params }) => {
  if (!z.uuid().safeParse(params.id).success) throw new ApiError(400, "Business id must be a UUID.");
  return unwrap(await admin.rpc("api_business_outcomes", { p_identity_id: identity.id, p_business_id: params.id }));
});

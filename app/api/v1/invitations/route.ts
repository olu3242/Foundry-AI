import { z } from "zod";
import { ApiError, unwrap, withApi } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

const Body = z.object({ contacts: z.array(z.string().max(254)).min(1).max(500) });

export const POST = withApi("invitations:write", async ({ identity, admin, request }) => {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new ApiError(400, "Body must be { contacts: string[] } with 1–500 phone numbers or emails.");
  return { invited: unwrap(await admin.rpc("api_invite", { p_identity_id: identity.id, p_contacts: parsed.data.contacts })) };
});

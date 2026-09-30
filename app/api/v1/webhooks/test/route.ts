import { unwrap, withApi } from "@/lib/api/v1";

export const dynamic = "force-dynamic";

/** Queues a sandbox.ping to each subscription of this key; the worker signs and delivers it. */
export const POST = withApi("events:subscribe", async ({ identity, admin }) =>
  ({ queued: unwrap(await admin.rpc("api_send_test_event", { p_identity_id: identity.id })) }));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  serviceRoleKey: "test-service-role-key",
}));

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://foundry.test" },
  serverEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: dependencies.serviceRoleKey, PASSPORT_TOKEN_PEPPER: "test-contact-pepper" }),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: dependencies.rateLimit }));

import { POST } from "@/app/api/waitlist/route";

const validPayload = {
  role: "Business owner",
  contact: "Ama@example.com",
  country: "Ghana",
  consent: "yes",
  website: "",
};

function request(body: unknown, origin = "http://localhost:3100") {
  return new Request("http://localhost:3100/api/waitlist", {
    method: "POST",
    headers: {
      origin,
      host: "localhost:3100",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.5",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  dependencies.rateLimit.mockResolvedValue(true);
  dependencies.serviceRoleKey = "test-service-role-key";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/waitlist", () => {
  it("stores a consented signup with a normalized contact hash and no public read path", async () => {
    const response = await POST(request(validPayload));
    const fetchMock = vi.mocked(fetch);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ received: true });
    expect(url.toString()).toBe("https://foundry.test/rest/v1/waitlist_signups?on_conflict=contact_hash");
    expect(body).toMatchObject({
      role: "Business owner",
      contact: "Ama@example.com",
      country: "Ghana",
    });
    expect(body.contact_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.consented_at).toEqual(expect.any(String));
    expect(options.headers).toMatchObject({ Prefer: "resolution=ignore-duplicates,return=minimal" });
    expect(dependencies.rateLimit).toHaveBeenCalledWith(expect.stringMatching(/^waitlist:[a-f0-9]{64}$/), {
      limit: 5,
      windowSeconds: 3600,
    });
  });

  it("derives the same keyed dedupe hash for email case variants", async () => {
    const fetchMock = vi.mocked(fetch);
    await POST(request(validPayload));
    await POST(request({ ...validPayload, contact: " ama@EXAMPLE.com " }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = fetchMock.mock.calls[0]?.[1]?.body;
    const secondBody = fetchMock.mock.calls[1]?.[1]?.body;
    expect(firstBody).toBeDefined();
    expect(secondBody).toBeDefined();
    const first = JSON.parse(String(firstBody)) as { contact_hash: string };
    const second = JSON.parse(String(secondBody)) as { contact_hash: string };
    expect(first.contact_hash).toBe(second.contact_hash);
  });

  it("rejects cross-origin requests before rate limiting or storage", async () => {
    const response = await POST(request(validPayload, "https://attacker.test"));

    expect(response.status).toBe(403);
    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not trust forwarded host headers to authorize another origin", async () => {
    const forged = request(validPayload, "https://attacker.test");
    forged.headers.set("x-forwarded-host", "attacker.test");
    forged.headers.set("x-forwarded-proto", "https");
    const response = await POST(forged);

    expect(response.status).toBe(403);
    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed and unconsented payloads", async () => {
    const response = await POST(request({ ...validPayload, consent: undefined }));

    expect(response.status).toBe(400);
    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects oversized streamed bodies even without a content-length header", async () => {
    const response = await POST(request({ ...validPayload, country: "x".repeat(5000) }));

    expect(response.status).toBe(413);
    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rate-limits repeated attempts", async () => {
    dependencies.rateLimit.mockResolvedValue(false);
    const response = await POST(request(validPayload));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts the honeypot without retaining bot-submitted data", async () => {
    const response = await POST(request({ ...validPayload, website: "spam" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ received: true });
    expect(dependencies.rateLimit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never claims success when the storage API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const response = await POST(request(validPayload));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "waitlist_unavailable" });
  });
});
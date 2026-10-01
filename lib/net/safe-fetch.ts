import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/**
 * B41 egress guard for every outbound call whose target can be influenced by a customer
 * (webhooks) or configuration (providers). Blocks private, loopback, link-local, CGNAT,
 * multicast and reserved ranges at *connect time* (the resolver result is checked, so DNS
 * rebinding can't swap in a private address after validation), never follows redirects,
 * and requires https unless private egress is explicitly allowed outside production.
 */
export class EgressBlockedError extends Error {}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4ToInt(ip: string) {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const n = v4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
  }
  if (family === 6) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedAddress(mapped[1]!);
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8:");
  }
  return true; // not an IP at all: refuse
}

export function privateEgressAllowed() {
  return process.env.ALLOW_PRIVATE_EGRESS === "1" && process.env.APP_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}

function guardedLookup(allowPrivate: boolean) {
  return (hostname: string, options: object, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) => {
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "");
      const list = addresses as LookupAddress[];
      const bad = list.find((a) => isBlockedAddress(a.address));
      if (bad && !allowPrivate) return callback(new EgressBlockedError(`Blocked egress to ${hostname} (${bad.address})`) as NodeJS.ErrnoException, "");
      const wantsAll = (options as { all?: boolean }).all;
      return wantsAll ? callback(null, list) : callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

export type SafeResponse = { status: number; ok: boolean; headers: http.IncomingHttpHeaders; text: string };

export async function safeFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<SafeResponse> {
  const u = new URL(url);
  const allowPrivate = privateEgressAllowed();
  if (u.protocol !== "https:" && !(allowPrivate && u.protocol === "http:")) throw new EgressBlockedError("Only https egress is allowed");
  if (u.username || u.password) throw new EgressBlockedError("Credentials in URLs are not allowed");
  if (isIP(u.hostname.replace(/^\[|\]$/g, "")) && isBlockedAddress(u.hostname.replace(/^\[|\]$/g, "")) && !allowPrivate) {
    throw new EgressBlockedError(`Blocked egress to ${u.hostname}`);
  }
  const mod = u.protocol === "https:" ? https : http;
  return new Promise<SafeResponse>((resolve, reject) => {
    const req = mod.request(u, {
      method: init.method ?? "GET", headers: init.headers, lookup: guardedLookup(allowPrivate) as never, timeout: init.timeoutMs ?? 10_000, signal: init.signal,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > 1_000_000) { req.destroy(new Error("Response too large")); return; }
        chunks.push(c);
      });
      res.on("end", () => {
        const status = res.statusCode ?? 0;
        // Redirects are never followed: a 3xx is reported as-is.
        resolve({ status, ok: status >= 200 && status < 300, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

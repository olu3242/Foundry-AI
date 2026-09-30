import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Share tokens are shown once; only a peppered HMAC is stored, so a DB leak can't open passports. */
export function newShareToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export function hashShareToken(token: string) {
  return createHmac("sha256", serverEnv().PASSPORT_TOKEN_PEPPER).update(token).digest("hex");
}

export function hashViewer(ip: string, day = new Date().toISOString().slice(0, 10)) {
  // Daily-rotating so views can be de-duplicated without keeping IPs.
  return createHmac("sha256", serverEnv().PASSPORT_TOKEN_PEPPER).update(`${day}:${ip}`).digest("hex").slice(0, 32);
}

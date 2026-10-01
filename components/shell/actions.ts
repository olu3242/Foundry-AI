"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { CURRENT_BUSINESS_COOKIE } from "@/lib/auth/current-business";

export async function switchBusiness(businessId: string) {
  // Only a preference: every business route re-checks membership.
  const id = z.uuid().parse(businessId);
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
}

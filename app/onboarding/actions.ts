"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, parseForm, type ActionState } from "@/lib/actions";
import { CURRENT_BUSINESS_COOKIE } from "@/lib/auth/current-business";

const schema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(120),
  sector: z.string().trim().max(60).optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().min(3),
});

export async function createBusiness(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;
  const { name, sector, country, currency, timezone } = parsed.data;
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_business", {
    p_name: name,
    p_sector: sector ?? "",
    p_country_code: country,
    p_currency: currency,
    p_timezone: timezone,
  });
  if (error || !id) return fail(error ? friendlyDbError(error) : "Could not create the business.");
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  redirect(`/b/${id}`);
}

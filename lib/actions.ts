import { z } from "zod";

export type ActionState<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
  | null;

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionState<never> {
  return { ok: false, error, fieldErrors };
}

/** Parses FormData with a zod schema, returning a typed value or a field-level failure. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData) {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return { ok: true as const, data: result.data as z.infer<S> };
  return {
    ok: false as const,
    state: fail("Please check the highlighted fields.", z.flattenError(result.error).fieldErrors as Record<string, string[]>),
  };
}

/** Maps Postgres/PostgREST errors to messages safe to show users. */
export function friendlyDbError(error: { code?: string; message: string }) {
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "P0001" || error.code === "P0002") return error.message;
  return "Something went wrong. Please try again.";
}

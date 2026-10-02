import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js|p/|api/cron|api/webhooks|api/health|api/v1).*)",
  ],
};
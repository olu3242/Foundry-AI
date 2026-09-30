import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets, the service worker, public share pages, and machine endpoints.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js|p/|api/cron|api/webhooks|api/health|api/v1).*)"],
};

import { defineConfig, devices } from "@playwright/test";

/** E2E against a local Supabase stack (`npm run db:start`) and `next dev`. */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Phone-sized layout without Chromium's mobile emulation, whose visual-viewport offset after
    // focusing a field makes coordinate clicks miss buttons on long forms.
    ...devices["Pixel 7"],
    isMobile: false,
    hasTouch: false,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});

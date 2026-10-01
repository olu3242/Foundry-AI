import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Foundry AI", template: "%s · Foundry" },
  description: "The AI-native business operating system for small and informal businesses. Run better. Sell more. Keep more. Prove it. Grow.",
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#07140E" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // B41: reading the request makes every page dynamic, so each response carries its CSP nonce.
  await headers();
  return (
    <html lang="en">
      <body className="min-h-dvh bg-aurora bg-no-repeat">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

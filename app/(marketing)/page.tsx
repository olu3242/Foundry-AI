/* eslint-disable @next/next/no-css-tags -- The Vite landing stylesheet is served as a standalone public asset. */
import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";

export const metadata: Metadata = {
  title: { absolute: "Foundry AI — Build the business behind the business" },
  description:
    "Tell Foundry what happened in your business. Get clearer records, see what needs attention, and review useful next steps.",
};

export default function Home() {
  const nonce = headers().then((requestHeaders) => requestHeaders.get("x-nonce") ?? undefined);
  return <LandingPage nonce={nonce} />;
}

async function LandingPage({ nonce }: { nonce: Promise<string | undefined> }) {
  const scriptNonce = await nonce;
  return (
    <>
      <link rel="stylesheet" href="/assets/index-DatAl5Bq.css" />
      <div id="root" data-host-skip-link="true" />
      <Script
        type="module"
        src="/assets/index-BtMop7AY.js"
        nonce={scriptNonce}
        crossOrigin="anonymous"
      />
    </>
  );
}

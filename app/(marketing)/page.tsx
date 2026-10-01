import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";

export const metadata: Metadata = {
  title: { absolute: "Foundry AI — Build the business behind the business" },
  description:
    "Foundry AI is an AI business partner for small and informal businesses in Africa. Record sales by voice, see what customers owe you, prove your business and reach new opportunities.",
};

export default function Home() {
  const nonce = headers().then((requestHeaders) => requestHeaders.get("x-nonce") ?? undefined);
  return <LandingPage nonce={nonce} />;
}

async function LandingPage({ nonce }: { nonce: Promise<string | undefined> }) {
  const scriptNonce = await nonce;
  return (
    <>
      <link rel="stylesheet" href="/assets/index-BcKfmTS7.css" />
      <div id="root" />
      <Script
        type="module"
        src="/assets/index-ven1ZNea.js"
        nonce={scriptNonce}
        crossOrigin="anonymous"
      />
    </>
  );
}

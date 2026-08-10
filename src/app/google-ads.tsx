"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

// Injeta o Google Ads (gtag.js) com o ID configurado no painel (via /api/config).
export function GoogleAds() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setId(d?.googleAdsId || null))
      .catch(() => {});
  }, []);

  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}

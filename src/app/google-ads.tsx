import Script from "next/script";

// Injeta o Google Ads (gtag.js) usando o ID definido na variável de ambiente
// NEXT_PUBLIC_GOOGLE_ADS_ID (ex.: "AW-XXXXXXXXX"). Se não estiver definida,
// nada é renderizado.
export function GoogleAds() {
  const id = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

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

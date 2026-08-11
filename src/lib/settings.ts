import { getSettings, hasDb } from "@/lib/db";

// Valor padrão do Google Ads (tag base) — pode ser sobrescrito no painel.
export const DEFAULT_GOOGLE_ADS_ID = "AW-16999732658";

export type SiteSettings = {
  googleAdsId: string; // AW-XXXXXXXXX (tag base)
  conversionLabel: string; // rótulo da conversão (parte após a barra)
};

// Lê as configurações do banco, com fallback para env/default. Nunca lança.
export async function loadSettings(): Promise<SiteSettings> {
  let stored: Record<string, string> = {};
  if (hasDb()) {
    try {
      stored = await getSettings();
    } catch {
      stored = {};
    }
  }
  return {
    googleAdsId:
      stored.google_ads_id ||
      process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ||
      DEFAULT_GOOGLE_ADS_ID,
    conversionLabel: stored.google_conversion_label || "",
  };
}

// Webhook de saída (server-only — NÃO expor publicamente o segredo).
export async function getOutboundWebhook(): Promise<{
  url: string;
  secret: string;
}> {
  let stored: Record<string, string> = {};
  if (hasDb()) {
    try {
      stored = await getSettings();
    } catch {
      stored = {};
    }
  }
  return {
    url: stored.outbound_webhook_url || "",
    secret: stored.outbound_webhook_secret || "",
  };
}

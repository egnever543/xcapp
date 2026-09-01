import { getSettings, hasDb } from "@/lib/db";

// Valor padrão do Google Ads (tag base) — pode ser sobrescrito no painel.
export const DEFAULT_GOOGLE_ADS_ID = "AW-16999732658";

// Tutoriais de login padrão — podem ser trocados no painel.
export const DEFAULT_TUTORIAL_REMOTE_URL = "https://youtu.be/OeWl9VX2UE4";
export const DEFAULT_TUTORIAL_TV_URL = "https://youtu.be/8cbPeLCofXA";

export type SiteSettings = {
  googleAdsId: string; // AW-XXXXXXXXX (tag base)
  conversionLabel: string; // rótulo da conversão (parte após a barra)
  tutorialRemoteUrl: string; // tutorial de login: instalação remota
  tutorialTvUrl: string; // tutorial de login: instalação na própria TV
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
    // "" no banco (definido pelo painel) tem prioridade; sem chave, usa o padrão.
    tutorialRemoteUrl:
      stored.tutorial_remote_url != null
        ? stored.tutorial_remote_url
        : DEFAULT_TUTORIAL_REMOTE_URL,
    tutorialTvUrl:
      stored.tutorial_tv_url != null
        ? stored.tutorial_tv_url
        : DEFAULT_TUTORIAL_TV_URL,
  };
}

// Só os tutoriais de login (para injetar em e-mail/WhatsApp/site).
export async function getLoginTutorials(): Promise<{
  remoteUrl: string;
  tvUrl: string;
}> {
  const s = await loadSettings();
  return { remoteUrl: s.tutorialRemoteUrl, tvUrl: s.tutorialTvUrl };
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

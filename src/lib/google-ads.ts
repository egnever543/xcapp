// Integração com a API do Google Ads (OAuth "Entrar com Google" + relatórios
// e ações leves de gestão). Server-only.
//
// Configuração (variáveis de ambiente):
//   GOOGLE_OAUTH_CLIENT_ID      — client id do OAuth (Google Cloud)
//   GOOGLE_OAUTH_CLIENT_SECRET  — client secret do OAuth
//   GOOGLE_ADS_DEVELOPER_TOKEN  — developer token (do MCC)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID— id do MCC (só dígitos), usado como login-customer-id
//
// O refresh token da conexão é guardado no banco (site_settings).

import { getSettings, setSetting } from "@/lib/db";

const API_VERSION = "v18";
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/adwords";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(
  /\D/g,
  "",
);

// Chaves no site_settings.
const K_REFRESH = "google_ads_refresh_token";
const K_EMAIL = "google_ads_connected_email";

export function isOAuthConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && DEVELOPER_TOKEN);
}

// Só dígitos (a API usa o customer id sem traços).
function digits(id: string): string {
  return (id ?? "").replace(/\D/g, "");
}

// URL de consentimento do Google (offline p/ receber refresh token).
export function buildAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

// Troca o "code" pelo refresh token e salva no banco.
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<void> {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json?.refresh_token) {
    throw new Error(
      json?.error_description ??
        json?.error ??
        "Falha ao obter o refresh token (verifique se marcou consentimento).",
    );
  }
  await setSetting(K_REFRESH, String(json.refresh_token));

  // Descobre o e-mail da conta conectada (informativo).
  try {
    const info = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${json.access_token}` } },
    ).then((r) => r.json());
    if (info?.email) await setSetting(K_EMAIL, String(info.email));
  } catch {
    // opcional
  }
}

export type ConnectionStatus = {
  connected: boolean;
  email: string;
  configured: boolean;
};

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const s = await getSettings().catch(() => ({}) as Record<string, string>);
  return {
    connected: !!s[K_REFRESH],
    email: s[K_EMAIL] ?? "",
    configured: isOAuthConfigured(),
  };
}

export async function disconnect(): Promise<void> {
  await setSetting(K_REFRESH, "");
  await setSetting(K_EMAIL, "");
}

// Access token a partir do refresh token salvo.
async function getAccessToken(): Promise<string> {
  const s = await getSettings();
  const refresh = s[K_REFRESH];
  if (!refresh) throw new Error("Google Ads não conectado.");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ??
        "Sessão do Google expirou. Reconecte o Google Ads.",
    );
  }
  return String(json.access_token);
}

function apiHeaders(accessToken: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (LOGIN_CUSTOMER_ID) h["login-customer-id"] = LOGIN_CUSTOMER_ID;
  return h;
}

// Executa uma consulta GAQL (searchStream) e devolve as linhas cruas.
async function gaql(
  customerId: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const cid = digits(customerId);
  if (!cid) throw new Error("Conta do Google Ads (customer id) não definida.");
  const token = await getAccessToken();
  const res = await fetch(
    `${API_BASE}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: apiHeaders(token),
      body: JSON.stringify({ query }),
      cache: "no-store",
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.[0]?.error?.message ??
      `Falha na API do Google Ads (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  // searchStream devolve um array de blocos { results: [...] }.
  const blocks = Array.isArray(json) ? json : [json];
  const rows: Record<string, unknown>[] = [];
  for (const b of blocks) {
    const results = (b?.results ?? []) as Record<string, unknown>[];
    for (const r of results) rows.push(r);
  }
  return rows;
}

export type CampaignMetrics = {
  id: string;
  name: string;
  status: string; // ENABLED | PAUSED | REMOVED
  budgetResource: string | null;
  budgetDaily: number; // orçamento diário em reais
  cost: number; // gasto no período (reais)
  impressions: number;
  clicks: number;
  conversions: number;
  conversionsValue: number;
};

// Micros → valor (a API usa micros: 1.000.000 = 1 unidade da moeda).
function fromMicros(v: unknown): number {
  return Number(v ?? 0) / 1_000_000;
}
function num(v: unknown): number {
  return Number(v ?? 0);
}

// Relatório de campanhas dos últimos N dias.
export async function listCampaignMetrics(
  customerId: string,
  days = 30,
): Promise<CampaignMetrics[]> {
  const range =
    days <= 7 ? "LAST_7_DAYS" : days <= 14 ? "LAST_14_DAYS" : "LAST_30_DAYS";
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign_budget.resource_name,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING ${range}
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;
  const rows = await gaql(customerId, query);
  return rows.map((r) => {
    const campaign = (r.campaign ?? {}) as Record<string, unknown>;
    const budget = (r.campaignBudget ?? {}) as Record<string, unknown>;
    const metrics = (r.metrics ?? {}) as Record<string, unknown>;
    return {
      id: String(campaign.id ?? ""),
      name: String(campaign.name ?? ""),
      status: String(campaign.status ?? ""),
      budgetResource: budget.resourceName ? String(budget.resourceName) : null,
      budgetDaily: fromMicros(budget.amountMicros),
      cost: fromMicros(metrics.costMicros),
      impressions: num(metrics.impressions),
      clicks: num(metrics.clicks),
      conversions: num(metrics.conversions),
      conversionsValue: num(metrics.conversionsValue),
    };
  });
}

// ===== Fase 2: gestão leve (pausar/ativar + orçamento) =====

async function mutate(
  customerId: string,
  path: string,
  operations: unknown[],
): Promise<void> {
  const cid = digits(customerId);
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/customers/${cid}/${path}:mutate`, {
    method: "POST",
    headers: apiHeaders(token),
    body: JSON.stringify({ operations }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.[0]?.error?.message ??
      `Falha ao aplicar a alteração (HTTP ${res.status}).`;
    throw new Error(msg);
  }
}

// Pausa ou ativa uma campanha.
export async function setCampaignStatus(
  customerId: string,
  campaignId: string,
  status: "ENABLED" | "PAUSED",
): Promise<void> {
  const cid = digits(customerId);
  await mutate(cid, "campaigns", [
    {
      update: {
        resourceName: `customers/${cid}/campaigns/${campaignId}`,
        status,
      },
      updateMask: "status",
    },
  ]);
}

// Ajusta o orçamento diário (reais) de uma campanha, pelo resource do orçamento.
export async function setCampaignBudget(
  customerId: string,
  budgetResource: string,
  dailyReais: number,
): Promise<void> {
  const amountMicros = Math.round(dailyReais * 1_000_000);
  await mutate(customerId, "campaignBudgets", [
    {
      update: { resourceName: budgetResource, amountMicros },
      updateMask: "amount_micros",
    },
  ]);
}

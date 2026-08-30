"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import {
  getPurchase,
  setSetting,
  getApp,
  upsertApp,
  deleteApp,
} from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";
import { getOutboundWebhook } from "@/lib/settings";
import { normalizeHex } from "@/lib/color";
import { provisionPurchase } from "@/lib/provisioning";
import { releaseProvision, getAppSalesSummary } from "@/lib/db";
import {
  listCampaignMetrics,
  setCampaignStatus,
  setCampaignBudget,
  disconnect as googleDisconnect,
  type CampaignMetrics,
} from "@/lib/google-ads";

export type SettingsState = { ok?: boolean; error?: string };

// Salva as configurações de marketing (Google Ads) no banco.
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const googleAdsId = String(formData.get("google_ads_id") ?? "").trim();
  const conversionLabel = String(
    formData.get("google_conversion_label") ?? "",
  ).trim();
  try {
    await setSetting("google_ads_id", googleAdsId);
    await setSetting("google_conversion_label", conversionLabel);
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message ?? "Falha ao salvar." };
  }
}

// Salva a URL (e segredo) do webhook de saída.
export async function saveWebhook(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const url = String(formData.get("outbound_webhook_url") ?? "").trim();
  const secret = String(formData.get("outbound_webhook_secret") ?? "").trim();
  if (url && !/^https:\/\//i.test(url)) {
    return { error: "A URL do webhook deve começar com https://" };
  }
  try {
    await setSetting("outbound_webhook_url", url);
    // Só atualiza o segredo se um novo valor foi informado (em branco = manter).
    if (secret) await setSetting("outbound_webhook_secret", secret);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message ?? "Falha ao salvar." };
  }
}

// Envia um evento de teste para o webhook configurado (com feedback real).
export async function testWebhook(): Promise<{ ok: boolean; error?: string }> {
  const { url, secret } = await getOutboundWebhook();
  if (!url) {
    return { ok: false, error: "Configure e salve a URL primeiro." };
  }
  const body = JSON.stringify({
    event: "test",
    data: { message: "Evento de teste do painel xciptv." },
    timestamp: new Date().toISOString(),
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Signature"] =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(body).digest("hex");
  }
  try {
    const r = await fetch(url, { method: "POST", headers, body });
    if (!r.ok) return { ok: false, error: `Destino respondeu ${r.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível conectar ao destino." };
  }
}

// Reenvia o e-mail de acesso de uma compra usando os dados salvos no banco.
export async function resendEmail(
  transactionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const purchase = await getPurchase(transactionId);
  if (!purchase) {
    return { ok: false, error: "Compra não encontrada." };
  }
  if (!purchase.email) {
    return { ok: false, error: "Sem e-mail cadastrado nesta compra." };
  }
  if (!purchase.username || !purchase.password) {
    return { ok: false, error: "Acesso ainda não gerado (não pago?)." };
  }
  const app = purchase.app ? await getApp(purchase.app) : null;
  try {
    await sendAccessEmail({
      email: purchase.email,
      username: purchase.username,
      password: purchase.password,
      appName: app?.name,
      accessUrl: app?.accessUrl || undefined,
      color: app?.color,
      intro: app?.emailIntro || undefined,
      tutorialUrl: app?.tutorialUrl || undefined,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao enviar." };
  }
}

// Reprocessa o provisionamento de uma compra paga (cria a conta no painel e
// envia o e-mail). Útil quando o pagamento entrou mas a criação da conta
// falhou. Devolve o erro real do painel quando não conseguir.
export async function retryProvision(
  transactionId: string,
): Promise<{ ok: boolean; error?: string; username?: string }> {
  let result = await provisionPurchase(transactionId);
  // Se uma tentativa anterior travou a "claim" sem gerar credenciais, libera
  // e tenta de novo uma vez (ação manual do painel).
  if (!result.ok && result.status === 409) {
    await releaseProvision(transactionId);
    result = await provisionPurchase(transactionId);
  }
  revalidatePath("/admin");
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, username: result.username };
}

// ---- Gestão de apps (multi-tenant) ----

export type AppFormState = { ok?: boolean; error?: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Cria ou atualiza um app a partir do formulário do painel.
export async function saveApp(
  _prev: AppFormState,
  formData: FormData,
): Promise<AppFormState> {
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const color = normalizeHex(String(formData.get("color") ?? ""));
  const logoUrl = String(formData.get("logo_url") ?? "").trim();
  const accessUrl = String(formData.get("access_url") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const videoId = String(formData.get("video_id") ?? "").trim();
  const emailIntro = String(formData.get("email_intro") ?? "").trim();
  const tutorialUrl = String(formData.get("tutorial_url") ?? "").trim();
  const googleAdsCustomerId = String(
    formData.get("google_ads_customer_id") ?? "",
  )
    .replace(/\D/g, "");
  const active = formData.get("active") != null;

  if (!slug || !SLUG_RE.test(slug)) {
    return {
      error: "Slug inválido. Use apenas letras minúsculas, números e hífen.",
    };
  }
  if (slug === "admin" || slug === "api" || slug === "planos") {
    return { error: "Este slug é reservado." };
  }
  if (!name) {
    return { error: "Informe o nome do app." };
  }

  try {
    await upsertApp({
      slug,
      name,
      color,
      logoUrl,
      accessUrl,
      whatsapp,
      videoId,
      emailIntro,
      tutorialUrl,
      googleAdsCustomerId,
      active,
    });
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    revalidatePath(`/${slug}`);
    return { ok: true };
  } catch (err) {
    return { error: (err as Error).message ?? "Falha ao salvar o app." };
  }
}

// Remove um app pelo slug.
export async function removeApp(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await deleteApp(slug);
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao remover." };
  }
}

// ---- Google Ads ----

export type CampaignsResult = {
  ok: boolean;
  error?: string;
  campaigns?: CampaignMetrics[];
  sales?: { count: number; revenue: number };
};

// Carrega as campanhas de um app (pela conta associada) + as vendas reais do
// período, para exibir o ROAS real no painel.
export async function loadCampaigns(
  appSlug: string,
  days = 30,
): Promise<CampaignsResult> {
  const app = await getApp(appSlug);
  if (!app) return { ok: false, error: "App não encontrado." };
  if (!app.googleAdsCustomerId) {
    return { ok: false, error: "Este app não tem conta do Google Ads definida." };
  }
  try {
    const campaigns = await listCampaignMetrics(app.googleAdsCustomerId, days);
    const sales = await getAppSalesSummary(appSlug, days).catch(() => ({
      count: 0,
      revenue: 0,
    }));
    return { ok: true, campaigns, sales };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao consultar." };
  }
}

// Pausa/ativa uma campanha (Fase 2).
export async function updateCampaignStatus(
  appSlug: string,
  campaignId: string,
  status: "ENABLED" | "PAUSED",
): Promise<{ ok: boolean; error?: string }> {
  const app = await getApp(appSlug);
  if (!app?.googleAdsCustomerId) {
    return { ok: false, error: "Conta do Google Ads não definida." };
  }
  try {
    await setCampaignStatus(app.googleAdsCustomerId, campaignId, status);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao aplicar." };
  }
}

// Ajusta o orçamento diário (reais) de uma campanha (Fase 2).
export async function updateCampaignBudget(
  appSlug: string,
  budgetResource: string,
  dailyReais: number,
): Promise<{ ok: boolean; error?: string }> {
  const app = await getApp(appSlug);
  if (!app?.googleAdsCustomerId) {
    return { ok: false, error: "Conta do Google Ads não definida." };
  }
  if (!(dailyReais > 0)) {
    return { ok: false, error: "Informe um orçamento válido." };
  }
  try {
    await setCampaignBudget(app.googleAdsCustomerId, budgetResource, dailyReais);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao aplicar." };
  }
}

// Desconecta a conta do Google Ads (remove o refresh token salvo).
export async function disconnectGoogleAds(): Promise<{ ok: boolean }> {
  await googleDisconnect();
  revalidatePath("/admin");
  return { ok: true };
}

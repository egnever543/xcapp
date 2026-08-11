"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getPurchase, setSetting } from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";
import { getOutboundWebhook } from "@/lib/settings";

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
  try {
    await sendAccessEmail({
      email: purchase.email,
      username: purchase.username,
      password: purchase.password,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Falha ao enviar." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getPurchase, setSetting } from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";

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

"use server";

import { getPurchase } from "@/lib/db";
import { sendAccessEmail } from "@/lib/email";

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

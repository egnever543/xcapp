"use server";

import { sendLeadToChatbot } from "@/lib/chatbot";

export type LeadFormState = {
  error?: string;
  success?: boolean;
  email?: string;
  phone?: string;
  payUrl?: string;
  isTrial?: boolean;
};

// Valida e-mail e telefone, envia o lead ao chatbot e devolve a Pay URL.
// A persistência (localStorage) e a navegação são feitas no cliente.
export async function submitLead(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // Considera válido a partir de 10 dígitos (DDD + número).
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10;

  if (!emailValid) {
    return { error: "Informe um e-mail válido." };
  }
  if (!phoneValid) {
    return { error: "Informe um telefone válido com DDD." };
  }

  // Envia o lead para o chatbot e tenta obter a Pay URL da resposta.
  // Não bloqueia o fluxo caso a API falhe — o usuário segue para os planos.
  let payUrl: string | undefined;
  let isTrial: boolean | undefined;
  try {
    const result = await sendLeadToChatbot({ email, phone });
    payUrl = result.payUrl ?? undefined;
    isTrial = result.isTrial ?? undefined;
  } catch (err) {
    console.error("Falha ao enviar lead para o chatbot:", err);
  }

  return { success: true, email, phone, payUrl, isTrial };
}

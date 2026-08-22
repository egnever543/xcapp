"use server";

export type LeadFormState = {
  error?: string;
  success?: boolean;
  email?: string;
  phone?: string;
};

// Valida e-mail e telefone. Sem criação de teste: o cliente segue direto para
// os planos e a conta só é criada após o pagamento. A persistência
// (localStorage) e a navegação são feitas no cliente.
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

  return { success: true, email, phone };
}

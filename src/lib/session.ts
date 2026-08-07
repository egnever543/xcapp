import { cookies } from "next/headers";

// Chaves usadas para guardar os dados do lead na sessão (cookies).
const EMAIL_KEY = "lead_email";
const PHONE_KEY = "lead_phone";
const PAY_URL_KEY = "lead_pay_url";

// Duração da sessão: 7 dias.
const MAX_AGE = 60 * 60 * 24 * 7;

export type SessionLead = {
  email: string;
  phone: string;
  payUrl?: string;
};

// Salva e-mail, telefone e (opcionalmente) a Pay URL na sessão.
export async function setSessionLead(lead: SessionLead) {
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
  store.set(EMAIL_KEY, lead.email, options);
  store.set(PHONE_KEY, lead.phone, options);
  if (lead.payUrl) {
    store.set(PAY_URL_KEY, lead.payUrl, options);
  } else {
    store.delete(PAY_URL_KEY);
  }
}

// Lê os dados do lead salvos na sessão (ou null se não houver).
export async function getSessionLead(): Promise<SessionLead | null> {
  const store = await cookies();
  const email = store.get(EMAIL_KEY)?.value;
  const phone = store.get(PHONE_KEY)?.value;
  if (!email || !phone) return null;
  const payUrl = store.get(PAY_URL_KEY)?.value;
  return { email, phone, payUrl };
}

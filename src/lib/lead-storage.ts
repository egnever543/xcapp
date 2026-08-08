"use client";

// Persistência do lead no localStorage do navegador, com validade de 7 dias.

export type StoredLead = {
  email: string;
  phone: string;
  payUrl?: string;
};

type StoredLeadWithExpiry = StoredLead & { expiresAt: number };

const KEY = "xciptv_lead";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Salva o lead com prazo de expiração de 7 dias a partir de agora.
export function saveLead(lead: StoredLead) {
  if (typeof window === "undefined") return;
  const data: StoredLeadWithExpiry = {
    ...lead,
    expiresAt: Date.now() + MAX_AGE_MS,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Ignora falhas (ex.: storage cheio ou bloqueado).
  }
}

// Lê o lead salvo. Se estiver expirado (mais de 7 dias) ou inválido,
// remove e retorna null.
export function getLead(): StoredLead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as StoredLeadWithExpiry;
    const expired =
      !data ||
      typeof data.expiresAt !== "number" ||
      Date.now() > data.expiresAt;

    if (expired || !data.email || !data.phone) {
      window.localStorage.removeItem(KEY);
      return null;
    }

    return { email: data.email, phone: data.phone, payUrl: data.payUrl };
  } catch {
    return null;
  }
}

// Remove os dados salvos.
export function clearLead() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignora.
  }
}

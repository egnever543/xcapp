"use client";

// Persistência do lead no localStorage do navegador, com validade de 7 dias.

export type StoredLead = {
  email: string;
  phone: string;
  // Preenchidos após a compra ser confirmada e a conta provisionada.
  username?: string;
  password?: string;
  // true quando a compra foi concluída (conta criada).
  purchased?: boolean;
};

type StoredLeadWithExpiry = StoredLead & { expiresAt: number };

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Chave do localStorage por app (não mistura dados entre apps).
function keyFor(app: string): string {
  return `${app}_lead`;
}

// Salva o lead com prazo de expiração de 7 dias a partir de agora.
export function saveLead(app: string, lead: StoredLead) {
  if (typeof window === "undefined") return;
  const data: StoredLeadWithExpiry = {
    ...lead,
    expiresAt: Date.now() + MAX_AGE_MS,
  };
  try {
    window.localStorage.setItem(keyFor(app), JSON.stringify(data));
  } catch {
    // Ignora falhas (ex.: storage cheio ou bloqueado).
  }
}

// Lê o lead salvo. Se estiver expirado (mais de 7 dias) ou inválido,
// remove e retorna null.
export function getLead(app: string): StoredLead | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(app));
    if (!raw) return null;

    const data = JSON.parse(raw) as StoredLeadWithExpiry;
    const expired =
      !data ||
      typeof data.expiresAt !== "number" ||
      Date.now() > data.expiresAt;

    if (expired || !data.email || !data.phone) {
      window.localStorage.removeItem(keyFor(app));
      return null;
    }

    return {
      email: data.email,
      phone: data.phone,
      username: data.username,
      password: data.password,
      purchased: data.purchased,
    };
  } catch {
    return null;
  }
}

// Remove os dados salvos.
export function clearLead(app: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(app));
  } catch {
    // Ignora.
  }
}

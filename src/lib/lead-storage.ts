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

// ===== GCLID (Google Ads) =====
// Guarda o gclid/gbraid/wbraid capturado na URL do anúncio (validade ~90 dias),
// para anexar à compra e usar nas conversões offline.
const GCLID_KEY = "xc_gclid";
const GCLID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

// Lê da URL atual e salva (chamar no carregamento das páginas do app).
export function captureGclid() {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const g = p.get("gclid") || p.get("gbraid") || p.get("wbraid");
    if (!g) return;
    window.localStorage.setItem(
      GCLID_KEY,
      JSON.stringify({ g, at: Date.now() }),
    );
  } catch {
    // Ignora.
  }
}

// Retorna o gclid salvo (se ainda válido).
export function getGclid(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(GCLID_KEY);
    if (!raw) return "";
    const d = JSON.parse(raw) as { g: string; at: number };
    if (!d?.g || typeof d.at !== "number") return "";
    if (Date.now() - d.at > GCLID_MAX_AGE_MS) {
      window.localStorage.removeItem(GCLID_KEY);
      return "";
    }
    return d.g;
  } catch {
    return "";
  }
}

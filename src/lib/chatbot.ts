// Integração com a API do chatbot que devolve a URL de pagamento (Pay URL).

// Endpoint pode ser sobrescrito por variável de ambiente.
const CHATBOT_URL =
  process.env.CHATBOT_URL ??
  "https://sistema.ftspanel.vip/api/chatbot/nVrW8roLKa/RYAWRk1jlx";

// Procura recursivamente por uma string que pareça uma URL http(s) dentro de
// um valor de resposta desconhecido (objeto/array/string). Como ainda não
// sabemos o formato exato da resposta, isso mantém a extração robusta.
function findUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const match = value.match(/https?:\/\/[^\s"'<>]+/);
    return match ? match[0] : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    // Prioriza chaves com nomes comuns de URL de pagamento.
    const preferredKeys = [
      "pay_url",
      "payUrl",
      "payment_url",
      "paymentUrl",
      "checkout_url",
      "checkoutUrl",
      "url",
      "link",
    ];
    const record = value as Record<string, unknown>;
    for (const key of preferredKeys) {
      if (key in record) {
        const found = findUrl(record[key]);
        if (found) return found;
      }
    }
    for (const item of Object.values(record)) {
      const found = findUrl(item);
      if (found) return found;
    }
  }
  return null;
}

// Normaliza valores comuns de is_trial ("0"/"1", boolean, número) para boolean.
function normalizeBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["1", "true", "yes", "sim"].includes(s)) return true;
    if (["0", "false", "no", "nao", "não", ""].includes(s)) return false;
  }
  return null;
}

// Procura recursivamente pela chave "is_trial" na resposta.
function findIsTrial(value: unknown): boolean | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findIsTrial(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("is_trial" in record) {
      const b = normalizeBool(record["is_trial"]);
      if (b !== null) return b;
    }
    for (const item of Object.values(record)) {
      const found = findIsTrial(item);
      if (found !== null) return found;
    }
  }
  return null;
}

// Procura recursivamente a primeira string (ou número) associada a uma das
// chaves informadas — usado para achar username/password na resposta.
function findValueByKeys(value: unknown, keys: string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKeys(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const v = record[key];
      if (typeof v === "string" && v) return v;
      if (typeof v === "number") return String(v);
    }
    for (const item of Object.values(record)) {
      const found = findValueByKeys(item, keys);
      if (found) return found;
    }
  }
  return null;
}

export type ChatbotResult = {
  payUrl: string | null;
  isTrial: boolean | null;
  username: string | null;
  password: string | null;
  raw: string;
  status: number;
};

// Envia os dados do lead para o chatbot e tenta extrair a Pay URL da resposta.
export async function sendLeadToChatbot(lead: {
  email: string;
  phone: string;
}): Promise<ChatbotResult> {
  // A API espera os parâmetros na query string, no padrão:
  //   <webhook>?Content-Type=application/json&senderPhone=<telefone>
  const url = new URL(CHATBOT_URL);
  url.searchParams.set("Content-Type", "application/json");
  url.searchParams.set("senderPhone", lead.phone.replace(/\D/g, ""));

  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "*/*" },
    // Não deixa o pagamento travar por cache.
    cache: "no-store",
  });

  const raw = await res.text();

  let payUrl: string | null = null;
  let isTrial: boolean | null = null;
  let username: string | null = null;
  let password: string | null = null;
  try {
    const json = JSON.parse(raw);
    payUrl = findUrl(json);
    isTrial = findIsTrial(json);
    username = findValueByKeys(json, ["username", "user", "login", "usuario"]);
    password = findValueByKeys(json, ["password", "pass", "senha"]);
  } catch {
    // Resposta não é JSON: trata como texto puro.
    payUrl = findUrl(raw);
  }

  return { payUrl, isTrial, username, password, raw, status: res.status };
}

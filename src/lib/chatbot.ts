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

export type ChatbotResult = {
  payUrl: string | null;
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
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    // Envia também no corpo, por garantia.
    body: JSON.stringify({ email: lead.email, phone: lead.phone }),
    // Não deixa o pagamento travar por cache.
    cache: "no-store",
  });

  const raw = await res.text();

  let payUrl: string | null = null;
  try {
    payUrl = findUrl(JSON.parse(raw));
  } catch {
    // Resposta não é JSON: trata como texto puro.
    payUrl = findUrl(raw);
  }

  return { payUrl, raw, status: res.status };
}

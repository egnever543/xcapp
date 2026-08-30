// Integração BotBot — envia mensagens de WhatsApp (ex.: o Pix copia e cola de
// uma cobrança pendente, no momento da compra). Server-only.
//
// Configuração (variáveis de ambiente):
//   BOTBOT_AUTH_KEY — chave do usuário (header authKey)
//   BOTBOT_APP_KEY  — chave do dispositivo WhatsApp (vai dentro de channels.whatsapp)
//   BOTBOT_API_URL  — opcional (padrão https://botbot.chat)

const AUTH_KEY = process.env.BOTBOT_AUTH_KEY ?? "";
const APP_KEY = process.env.BOTBOT_APP_KEY ?? "";
const API_URL = (process.env.BOTBOT_API_URL || "https://botbot.chat").replace(
  /\/$/,
  "",
);

export function isBotbotConfigured(): boolean {
  return !!(AUTH_KEY && APP_KEY);
}

// Normaliza o telefone para o formato esperado pela BotBot (com DDI 55).
function normalizeBrPhone(phone: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

// Envia uma mensagem de texto por WhatsApp. Retorna true se enviada (2xx).
// Nunca lança — devolve false em erro/config ausente.
export async function sendWhatsappMessage(
  toRaw: string,
  message: string,
): Promise<boolean> {
  if (!isBotbotConfigured()) return false;
  const to = normalizeBrPhone(toRaw);
  if (!to) return false;

  try {
    const res = await fetch(`${API_URL}/api/v2/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authKey: AUTH_KEY },
      body: JSON.stringify({
        message,
        channels: { whatsapp: { appKey: APP_KEY, to } },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(
        "Falha BotBot:",
        res.status,
        await res.text().catch(() => ""),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro BotBot:", err);
    return false;
  }
}

// Versão com detalhes para diagnóstico no painel: devolve status HTTP e corpo.
export async function sendWhatsappDetailed(
  toRaw: string,
  message: string,
): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  if (!isBotbotConfigured()) {
    return {
      ok: false,
      status: 0,
      body: "",
      error:
        "BotBot não configurado (defina BOTBOT_AUTH_KEY e BOTBOT_APP_KEY e faça um redeploy).",
    };
  }
  const to = normalizeBrPhone(toRaw);
  if (!to) {
    return { ok: false, status: 0, body: "", error: "Telefone inválido." };
  }
  try {
    const res = await fetch(`${API_URL}/api/v2/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", authKey: AUTH_KEY },
      body: JSON.stringify({
        message,
        channels: { whatsapp: { appKey: APP_KEY, to } },
      }),
      cache: "no-store",
    });
    const body = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: "", error: (err as Error).message };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Envia o Pix copia e cola de uma cobrança pendente, em DUAS mensagens: a
// primeira explica; a segunda traz só o código (fica fácil de copiar). Um
// intervalo de ~3s separa as duas.
export async function sendPixCodeWhatsapp(input: {
  to: string;
  productName: string;
  amount: number; // em reais
  pixCode: string; // copia e cola
}): Promise<boolean> {
  if (!input.pixCode) return false;
  const valor = input.amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const intro =
    `🔔 *${input.productName}* — ${valor}\n\n` +
    `Para concluir sua compra, pague com o Pix copia e cola que vou enviar na próxima mensagem 👇\n\n` +
    `Assim que o pagamento for confirmado, enviamos seu acesso por aqui. 🚀`;

  await sendWhatsappMessage(input.to, intro);
  // Intervalo para o código chegar como mensagem separada.
  await sleep(3000);
  // Segunda mensagem: só o código, para o cliente copiar com um toque.
  return sendWhatsappMessage(input.to, input.pixCode);
}

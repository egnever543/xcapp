import crypto from "crypto";
import { getOutboundWebhook } from "@/lib/settings";

// Envia um evento para a URL de webhook configurada no painel (se houver).
// Assina o corpo com HMAC-SHA256 no header X-Signature quando há segredo.
export async function sendOutboundEvent(
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { url, secret } = await getOutboundWebhook();
  if (!url) return;

  const body = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Signature"] =
      "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  try {
    await fetch(url, { method: "POST", headers, body, cache: "no-store" });
  } catch (err) {
    console.error("Falha ao enviar webhook de saída:", err);
  }
}

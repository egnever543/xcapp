import { NextResponse } from "next/server";
import crypto from "crypto";
import { provisionPurchase } from "@/lib/provisioning";
import { updateStatus } from "@/lib/db";

// Secret do webhook (opcional). Se definido, valida X-Webhook-Signature.
const SECRET = process.env.FASTDEPIX_WEBHOOK_SECRET;

// Recebe os webhooks da FastDePix. Em transaction.approved/paid, provisiona o
// acesso (mesmo que o cliente tenha fechado a aba). Idempotente.
export async function POST(request: Request) {
  const raw = await request.text();

  if (SECRET) {
    const signature = request.headers.get("x-webhook-signature") ?? "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
    const valid =
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  }

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw);
  } catch {
    // payload não-JSON
  }

  // A FastDePix pode enviar o id/status no topo ou aninhados em "data"/
  // "transaction". Tenta as variações mais comuns.
  const nested = (data.data ?? data.transaction ?? {}) as Record<
    string,
    unknown
  >;
  const rawId =
    data.transaction_id ?? data.id ?? nested.id ?? nested.transaction_id ?? "";
  const transactionId = rawId ? String(rawId) : "";
  const status = String(data.status ?? nested.status ?? "");

  if (transactionId) {
    try {
      if (status === "paid" || status === "approved") {
        await provisionPurchase(transactionId);
      } else if (status) {
        await updateStatus(transactionId, status);
      }
    } catch (err) {
      console.error("Erro ao processar webhook:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

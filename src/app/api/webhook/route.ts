import { NextResponse } from "next/server";
import crypto from "crypto";

// Secret do webhook (opcional). Se definido, valida X-Webhook-Signature.
const SECRET = process.env.FASTDEPIX_WEBHOOK_SECRET;

// Recebe os webhooks da FastDePix (transaction.approved / transaction.paid, etc.).
// Ponto de encaixe para a futura API que gera o acesso e envia por e-mail.
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

  // TODO (futuro): ao receber transaction.approved/paid, gerar o acesso
  // conforme o pacote e enviar os dados por e-mail (idempotente por transaction_id).
  console.log(
    "FastDePix webhook:",
    data?.status ?? data?.event,
    data?.transaction_id ?? "",
  );

  return NextResponse.json({ ok: true });
}

// Fallback: a FastDePix tenta GET com payload na query se o POST retornar 405.
// Aqui o POST responde 200, então o GET serve só para verificação/health.
export async function GET() {
  return NextResponse.json({ ok: true });
}

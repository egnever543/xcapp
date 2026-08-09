import { NextResponse } from "next/server";
import { getPackage, priceReais } from "@/lib/packages";
import { createTransaction, getTransaction } from "@/lib/fastdepix";

// Cria uma cobrança PIX para o pacote escolhido.
export async function POST(request: Request) {
  let packageId = "";
  let phone = "";
  try {
    const body = await request.json();
    packageId = String(body?.packageId ?? "");
    phone = String(body?.phone ?? "");
  } catch {
    // corpo inválido
  }

  // Valida o pacote no servidor (o valor vem daqui, não do cliente).
  const pkg = getPackage(packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
  }

  // notification_url = webhook público deste site (para robustez futura).
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const notificationUrl =
    host && proto === "https" ? `${proto}://${host}/api/webhook` : undefined;

  try {
    const tx = await createTransaction({
      amount: priceReais(pkg.priceCents),
      phone,
      notificationUrl,
    });
    return NextResponse.json({
      id: tx.id,
      amount: tx.amount,
      status: tx.status,
      qrCode: tx.qrCode,
      qrCodeText: tx.qrCodeText,
      expiresAt: tx.expiresAt,
    });
  } catch (err) {
    console.error("Erro ao criar cobrança PIX:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Falha ao gerar o PIX." },
      { status: 502 },
    );
  }
}

// Consulta o status de uma cobrança: GET /api/pix?id=123
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  }
  try {
    const tx = await getTransaction(id);
    return NextResponse.json({ id: tx.id, status: tx.status });
  } catch (err) {
    console.error("Erro ao consultar cobrança PIX:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Falha ao consultar." },
      { status: 502 },
    );
  }
}

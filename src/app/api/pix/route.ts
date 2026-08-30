import { NextResponse, after } from "next/server";
import { getPackage, priceReais } from "@/lib/packages";
import { createTransaction, getTransaction } from "@/lib/fastdepix";
import { savePurchaseInit, hasDb, getApp } from "@/lib/db";
import { sendPixCodeWhatsapp } from "@/lib/botbot";

// Cria uma cobrança PIX para o pacote escolhido.
export async function POST(request: Request) {
  let packageId = "";
  let phone = "";
  let email = "";
  let app = "";
  try {
    const body = await request.json();
    packageId = String(body?.packageId ?? "");
    phone = String(body?.phone ?? "");
    email = String(body?.email ?? "");
    app = String(body?.app ?? "");
  } catch {
    // corpo inválido
  }

  // Valida o pacote no servidor (o valor vem daqui, não do cliente).
  const pkg = getPackage(packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
  }

  // notification_url = webhook público deste site (identifica nossas cobranças).
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

    // Registra a compra no banco (para histórico e provisionamento robusto).
    if (hasDb()) {
      try {
        await savePurchaseInit({
          transactionId: String(tx.id),
          email: email || undefined,
          phone: phone || undefined,
          packageId: pkg.id,
          packageLabel: `${pkg.durationLabel} · ${pkg.telas} tela(s)${pkg.adult ? " · +18" : ""}`,
          amount: priceReais(pkg.priceCents),
          app: app || undefined,
        });
      } catch (err) {
        console.error("Erro ao registrar a compra:", err);
      }
    }

    // Envia o Pix copia e cola no WhatsApp do cliente (cobrança pendente),
    // em segundo plano (after) — são duas mensagens com ~3s de intervalo, e
    // não devem atrasar a resposta do checkout. Tolerante a falha.
    if (phone && tx.qrCodeText) {
      const pixCode = tx.qrCodeText;
      const amount = priceReais(pkg.priceCents);
      const productBase = `${pkg.durationLabel} · ${pkg.telas} tela(s)${pkg.adult ? " · +18" : ""}`;
      after(async () => {
        try {
          const cfg =
            hasDb() && app ? await getApp(app).catch(() => null) : null;
          const nome = cfg?.name ?? "Seu plano";
          await sendPixCodeWhatsapp({
            to: phone,
            productName: `${nome} · ${productBase}`,
            amount,
            pixCode,
          });
        } catch (err) {
          console.error("Erro ao enviar Pix por WhatsApp:", err);
        }
      });
    }

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

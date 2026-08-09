import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPackage, priceReais } from "@/lib/packages";
import { getTransaction } from "@/lib/fastdepix";
import { createCustomer } from "@/lib/sigma";
import { sendAccessEmail } from "@/lib/email";

function genUsername(): string {
  return "xc" + crypto.randomBytes(4).toString("hex");
}
function genPassword(): string {
  return crypto.randomBytes(5).toString("hex");
}

// Provisiona o acesso após o pagamento: confirma a transação na FastDePix,
// cria o cliente no Sigma com o pacote escolhido e envia as credenciais.
export async function POST(request: Request) {
  let transactionId = "";
  let packageId = "";
  let email = "";
  let phone = "";
  try {
    const body = await request.json();
    transactionId = String(body?.transactionId ?? "");
    packageId = String(body?.packageId ?? "");
    email = String(body?.email ?? "").trim();
    phone = String(body?.phone ?? "").trim();
  } catch {
    // corpo inválido
  }

  if (!transactionId || !packageId) {
    return NextResponse.json(
      { error: "transactionId e packageId obrigatórios." },
      { status: 400 },
    );
  }

  const pkg = getPackage(packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
  }

  // Confirma o pagamento direto na fonte (evita provisionar sem pagar).
  let tx;
  try {
    tx = await getTransaction(transactionId);
  } catch (err) {
    console.error("Erro ao consultar transação:", err);
    return NextResponse.json(
      { error: "Não foi possível confirmar o pagamento." },
      { status: 502 },
    );
  }

  if (tx.status !== "paid" && tx.status !== "approved") {
    return NextResponse.json(
      { error: "Pagamento ainda não confirmado." },
      { status: 402 },
    );
  }

  // Confere que o valor pago corresponde ao preço do pacote.
  if (Math.abs(Number(tx.amount) - priceReais(pkg.priceCents)) > 0.01) {
    return NextResponse.json(
      { error: "Valor pago não corresponde ao pacote." },
      { status: 400 },
    );
  }

  const username = genUsername();
  const password = genPassword();

  try {
    await createCustomer({
      packageId: pkg.id,
      username,
      password,
      name: email ? email.split("@")[0] : undefined,
      email: email || undefined,
      whatsapp: phone ? phone.replace(/\D/g, "") : undefined,
      connections: pkg.telas,
    });
  } catch (err) {
    console.error("Erro ao criar cliente no Sigma:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Falha ao criar o acesso." },
      { status: 502 },
    );
  }

  // Envia as credenciais por e-mail (não bloqueia a resposta se falhar).
  if (email) {
    try {
      await sendAccessEmail({ email, username, password });
    } catch (err) {
      console.error("Erro ao enviar e-mail de acesso:", err);
    }
  }

  return NextResponse.json({ username, password });
}

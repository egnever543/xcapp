import { NextResponse } from "next/server";
import crypto from "crypto";
import { plans } from "@/lib/plans";
import { getTransaction } from "@/lib/fastdepix";
import { createCustomer, packageIdForPlan } from "@/lib/sigma";
import { sendAccessEmail } from "@/lib/email";

function genUsername(): string {
  return "xc" + crypto.randomBytes(4).toString("hex");
}
function genPassword(): string {
  return crypto.randomBytes(5).toString("hex");
}

// Provisiona o acesso após o pagamento: confirma a transação na FastDePix,
// cria o cliente no Sigma conforme o plano e envia as credenciais por e-mail.
export async function POST(request: Request) {
  let transactionId = "";
  let email = "";
  let phone = "";
  try {
    const body = await request.json();
    transactionId = String(body?.transactionId ?? "");
    email = String(body?.email ?? "").trim();
    phone = String(body?.phone ?? "").trim();
  } catch {
    // corpo inválido
  }

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId obrigatório." },
      { status: 400 },
    );
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

  // Determina o plano pelo valor pago (não confia no cliente).
  const plan = plans.find((p) => Number(p.price) === Number(tx.amount));
  if (!plan) {
    return NextResponse.json(
      { error: "Valor pago não corresponde a um plano." },
      { status: 400 },
    );
  }

  const packageId = packageIdForPlan(plan.id);
  if (!packageId) {
    return NextResponse.json(
      { error: `Pacote não configurado para o plano "${plan.id}".` },
      { status: 500 },
    );
  }

  const username = genUsername();
  const password = genPassword();

  try {
    await createCustomer({
      packageId,
      username,
      password,
      name: email ? email.split("@")[0] : undefined,
      email: email || undefined,
      whatsapp: phone ? phone.replace(/\D/g, "") : undefined,
      connections: Number(process.env.SIGMA_CONNECTIONS ?? 1),
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

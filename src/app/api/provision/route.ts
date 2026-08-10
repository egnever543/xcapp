import { NextResponse } from "next/server";
import { provisionPurchase } from "@/lib/provisioning";

// Provisiona o acesso após o pagamento (disparado pelo cliente ao confirmar).
export async function POST(request: Request) {
  let transactionId = "";
  try {
    const body = await request.json();
    transactionId = String(body?.transactionId ?? "");
  } catch {
    // corpo inválido
  }

  if (!transactionId) {
    return NextResponse.json(
      { error: "transactionId obrigatório." },
      { status: 400 },
    );
  }

  const result = await provisionPurchase(transactionId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    username: result.username,
    password: result.password,
  });
}

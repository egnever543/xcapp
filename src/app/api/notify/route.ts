import { NextResponse } from "next/server";
import { sendAccessEmail } from "@/lib/email";

// Envia o e-mail com os dados de acesso (URL, login, senha).
export async function POST(request: Request) {
  let email = "";
  let username = "";
  let password = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim();
    username = String(body?.username ?? "").trim();
    password = String(body?.password ?? "").trim();
  } catch {
    // corpo inválido
  }

  if (!email || !username || !password) {
    return NextResponse.json(
      { error: "Dados incompletos (email, username, password)." },
      { status: 400 },
    );
  }

  try {
    await sendAccessEmail({ email, username, password });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    return NextResponse.json(
      { error: "Falha ao enviar o e-mail." },
      { status: 502 },
    );
  }
}

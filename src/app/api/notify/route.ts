import { NextResponse } from "next/server";

// Configuração de e-mail (Resend) e host do Xtream, via variáveis de ambiente.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Remetente verificado no Resend. Ex.: "xciptv <no-reply@seudominio.com>"
const EMAIL_FROM = process.env.EMAIL_FROM;
// Host do servidor Xtream, usado como URL de acesso no e-mail.
const XTREAM_HOST = process.env.XTREAM_HOST;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Envia o e-mail com os dados de acesso (URL, login, senha) via Resend.
export async function POST(request: Request) {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return NextResponse.json(
      { error: "E-mail não configurado (RESEND_API_KEY/EMAIL_FROM)." },
      { status: 500 },
    );
  }

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

  const accessUrl = XTREAM_HOST ?? "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0a0a0a;">
      <h2 style="color: #1477e1;">Seus dados de acesso — xciptv</h2>
      <p>Sua compra foi confirmada! Use os dados abaixo para acessar no app:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">URL / Servidor</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(accessUrl)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">Usuário</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(username)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">Senha</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(password)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 13px;">
        Guarde estes dados em local seguro. Em caso de dúvida, entre em contato pelo nosso WhatsApp.
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: email,
        subject: "Seus dados de acesso — xciptv",
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Falha no envio (Resend):", res.status, detail);
      return NextResponse.json(
        { error: "Falha ao enviar o e-mail." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    return NextResponse.json(
      { error: "Falha ao enviar o e-mail." },
      { status: 502 },
    );
  }
}

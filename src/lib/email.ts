// Envio de e-mail com os dados de acesso, via Resend.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Remetente verificado no Resend. Ex.: "xciptv <no-reply@seudominio.com>"
const EMAIL_FROM = process.env.EMAIL_FROM;
// Host de acesso mostrado no e-mail (URL do servidor no app).
const ACCESS_URL = process.env.XTREAM_HOST ?? "";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Envia o e-mail com URL, login e senha. Lança erro se o envio falhar.
export async function sendAccessEmail(params: {
  email: string;
  username: string;
  password: string;
}): Promise<void> {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error("E-mail não configurado (RESEND_API_KEY/EMAIL_FROM).");
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0a0a0a;">
      <h2 style="color: #1477e1;">Seus dados de acesso — xciptv</h2>
      <p>Sua compra foi confirmada! Use os dados abaixo para acessar no app:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">URL / Servidor</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(ACCESS_URL)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">Usuário</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(params.username)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e5e5; font-weight: bold;">Senha</td>
          <td style="padding: 8px; border: 1px solid #e5e5e5;">${escapeHtml(params.password)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 13px;">
        Guarde estes dados em local seguro. Em caso de dúvida, entre em contato pelo nosso WhatsApp.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: params.email,
      subject: "Seus dados de acesso — xciptv",
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Falha no envio (Resend ${res.status}): ${detail}`);
  }
}

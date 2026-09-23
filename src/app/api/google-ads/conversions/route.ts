import { listPaidSince } from "@/lib/db";
import { buildConversionsCsv } from "@/lib/conversions-feed";

// Feed de conversões offline do Google Ads (importação agendada via HTTPS).
// O Google busca este CSV com Basic Auth (usuário/senha definidos abaixo) e
// recebe as vendas PAGAS das últimas 24h a cada chamada.
//
// Configuração (variáveis de ambiente):
//   GOOGLE_CONV_FEED_USER — usuário do Basic Auth
//   GOOGLE_CONV_FEED_PASS — senha do Basic Auth
//   GOOGLE_ADS_CONVERSION_NAME — (opcional) nome da ação de conversão

const USER = process.env.GOOGLE_CONV_FEED_USER ?? "";
const PASS = process.env.GOOGLE_CONV_FEED_PASS ?? "";
const CONVERSION_NAME = process.env.GOOGLE_ADS_CONVERSION_NAME ?? "";

function unauthorized(): Response {
  return new Response("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="conversions", charset="UTF-8"' },
  });
}

export async function GET(request: Request) {
  if (!USER || !PASS) {
    return new Response(
      "Feed não configurado (defina GOOGLE_CONV_FEED_USER e GOOGLE_CONV_FEED_PASS).",
      { status: 500 },
    );
  }

  // Basic Auth (as credenciais são as que você informa na tela do Google Ads).
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return unauthorized();
  let ok = false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    ok = decoded.slice(0, sep) === USER && decoded.slice(sep + 1) === PASS;
  } catch {
    ok = false;
  }
  if (!ok) return unauthorized();

  // Permite ajustar a janela via ?hours= (padrão 24).
  const hoursParam = Number(new URL(request.url).searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 24;

  let csv: string;
  try {
    const rows = await listPaidSince(hours);
    csv = buildConversionsCsv(rows, CONVERSION_NAME);
  } catch (err) {
    console.error("Erro ao gerar o feed de conversões:", err);
    return new Response("Falha ao gerar o feed.", { status: 500 });
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="conversions.csv"',
      "Cache-Control": "no-store",
    },
  });
}

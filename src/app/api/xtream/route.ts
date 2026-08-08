import { NextResponse } from "next/server";

// Host do servidor Xtream, definido por variável de ambiente.
// Ex.: XTREAM_HOST=http://SEU_HOST:80
const XTREAM_HOST = process.env.XTREAM_HOST;

// Normaliza is_trial ("0"/"1", boolean, número) para boolean.
function normalizeBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["1", "true", "yes", "sim"].includes(s)) return true;
    if (["0", "false", "no", "nao", "não", ""].includes(s)) return false;
  }
  return null;
}

// Consulta o player_api.php do Xtream (no servidor, evitando CORS/mixed-content)
// e devolve os dados de conta — incluindo o vencimento (exp_date).
export async function POST(request: Request) {
  if (!XTREAM_HOST) {
    return NextResponse.json(
      { error: "XTREAM_HOST não configurado." },
      { status: 500 },
    );
  }

  let username = "";
  let password = "";
  try {
    const body = await request.json();
    username = String(body?.username ?? "");
    password = String(body?.password ?? "");
  } catch {
    // corpo inválido
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "username e password são obrigatórios." },
      { status: 400 },
    );
  }

  const url = new URL("/player_api.php", XTREAM_HOST);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const info = (data?.user_info ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      auth: info.auth ?? null,
      status: info.status ?? null,
      // exp_date: timestamp Unix em segundos (ou null = sem expiração).
      expDate: info.exp_date ?? null,
      isTrial: normalizeBool(info.is_trial),
      maxConnections: info.max_connections ?? null,
      activeCons: info.active_cons ?? null,
    });
  } catch (err) {
    console.error("Falha ao consultar o Xtream:", err);
    return NextResponse.json(
      { error: "Falha ao consultar o servidor Xtream." },
      { status: 502 },
    );
  }
}

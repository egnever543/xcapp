// Integração com a API do painel Sigma (FTS Panel) — criação de cliente.
// Docs: https://sistema.ftspanel.vip/api/integration/v1

const BASE_URL =
  process.env.SIGMA_BASE_URL ??
  "https://sistema.ftspanel.vip/api/integration/v1";
const TOKEN = process.env.SIGMA_API_TOKEN;
// userId (hashid) do dono das contas criadas — opcional.
const OWNER_ID = process.env.SIGMA_OWNER_ID;

// Mapeia o plano do site para o packageId do painel (via env vars).
export function packageIdForPlan(planId: string): string | null {
  const map: Record<string, string | undefined> = {
    mensal: process.env.SIGMA_PACKAGE_MENSAL,
    semestral: process.env.SIGMA_PACKAGE_SEMESTRAL,
    anual: process.env.SIGMA_PACKAGE_ANUAL,
  };
  return map[planId] ?? null;
}

export type CreateCustomerInput = {
  packageId: string;
  username: string;
  password: string;
  name?: string;
  email?: string;
  whatsapp?: string;
  connections?: number;
};

// Cria um cliente no painel Sigma. Lança erro em caso de falha.
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<unknown> {
  if (!TOKEN) throw new Error("SIGMA_API_TOKEN não configurada.");

  const body: Record<string, unknown> = {
    packageId: input.packageId,
    username: input.username,
    password: input.password,
  };
  if (OWNER_ID) body.userId = OWNER_ID;
  if (input.name) body.name = input.name;
  if (input.email) body.email = input.email;
  if (input.whatsapp) body.whatsapp = input.whatsapp;
  if (input.connections) body.connections = input.connections;

  const res = await fetch(`${BASE_URL}/customers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (json as { message?: string })?.message ??
      `Falha ao criar cliente (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return json;
}

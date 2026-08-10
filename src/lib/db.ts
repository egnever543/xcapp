import { neon } from "@neondatabase/serverless";

// String de conexão injetada pela integração Neon/Vercel.
const CONNECTION =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  "";

export function hasDb(): boolean {
  return CONNECTION.length > 0;
}

// Cliente SQL (lança erro claro se não configurado).
function db() {
  if (!CONNECTION) {
    throw new Error("Banco não configurado (DATABASE_URL ausente).");
  }
  return neon(CONNECTION);
}

// Cria a tabela uma única vez por processo (idempotente).
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = db();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS purchases (
          transaction_id TEXT PRIMARY KEY,
          email TEXT,
          phone TEXT,
          package_id TEXT,
          package_label TEXT,
          amount NUMERIC,
          username TEXT,
          password TEXT,
          status TEXT DEFAULT 'pending',
          provisioned BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    })();
  }
  return schemaReady;
}

export type Purchase = {
  transactionId: string;
  email: string | null;
  phone: string | null;
  packageId: string | null;
  packageLabel: string | null;
  amount: number | null;
  username: string | null;
  password: string | null;
  status: string;
  provisioned: boolean;
  createdAt: string;
};

type Row = {
  transaction_id: string;
  email: string | null;
  phone: string | null;
  package_id: string | null;
  package_label: string | null;
  amount: string | number | null;
  username: string | null;
  password: string | null;
  status: string;
  provisioned: boolean;
  created_at: string;
};

function mapRow(r: Row): Purchase {
  return {
    transactionId: r.transaction_id,
    email: r.email,
    phone: r.phone,
    packageId: r.package_id,
    packageLabel: r.package_label,
    amount: r.amount != null ? Number(r.amount) : null,
    username: r.username,
    password: r.password,
    status: r.status,
    provisioned: r.provisioned,
    createdAt: r.created_at,
  };
}

// Registra a compra no momento da criação da cobrança PIX.
export async function savePurchaseInit(p: {
  transactionId: string;
  email?: string;
  phone?: string;
  packageId: string;
  packageLabel: string;
  amount: number;
}): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO purchases (transaction_id, email, phone, package_id, package_label, amount, status)
    VALUES (${p.transactionId}, ${p.email ?? null}, ${p.phone ?? null}, ${p.packageId}, ${p.packageLabel}, ${p.amount}, 'pending')
    ON CONFLICT (transaction_id) DO UPDATE
      SET email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          package_id = EXCLUDED.package_id,
          package_label = EXCLUDED.package_label,
          amount = EXCLUDED.amount,
          updated_at = now()
  `;
}

export async function getPurchase(
  transactionId: string,
): Promise<Purchase | null> {
  await ensureSchema();
  const sql = db();
  const rows = (await sql`
    SELECT * FROM purchases WHERE transaction_id = ${transactionId} LIMIT 1
  `) as Row[];
  return rows[0] ? mapRow(rows[0]) : null;
}

// Reivindica o provisionamento de forma atômica: retorna true só para o
// primeiro chamador (evita criar a conta duas vezes entre cliente e webhook).
export async function claimProvision(transactionId: string): Promise<boolean> {
  await ensureSchema();
  const sql = db();
  const rows = (await sql`
    UPDATE purchases SET provisioned = TRUE, updated_at = now()
    WHERE transaction_id = ${transactionId} AND provisioned = FALSE
    RETURNING transaction_id
  `) as { transaction_id: string }[];
  return rows.length > 0;
}

export async function releaseProvision(transactionId: string): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases SET provisioned = FALSE, updated_at = now()
    WHERE transaction_id = ${transactionId}
  `;
}

// Grava as credenciais geradas e marca como pago.
export async function saveCredentials(
  transactionId: string,
  username: string,
  password: string,
): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases
      SET username = ${username}, password = ${password}, status = 'paid', updated_at = now()
    WHERE transaction_id = ${transactionId}
  `;
}

export async function updateStatus(
  transactionId: string,
  status: string,
): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases SET status = ${status}, updated_at = now()
    WHERE transaction_id = ${transactionId}
  `;
}

export type PurchaseSummary = {
  total: number;
  paid: number;
  pending: number;
  paidAmount: number;
};

// Lista compras (com filtros) + resumo, para o painel admin.
export async function listPurchases(params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: Purchase[]; total: number; summary: PurchaseSummary }> {
  await ensureSchema();
  const sql = db();
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const items = (
    params.status
      ? ((await sql`
          SELECT * FROM purchases WHERE status = ${params.status}
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `) as Row[])
      : ((await sql`
          SELECT * FROM purchases
          ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
        `) as Row[])
  ).map(mapRow);

  const summaryRows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS paid_amount
    FROM purchases
  `) as {
    total: number;
    paid: number;
    pending: number;
    paid_amount: string | number;
  }[];
  const s = summaryRows[0];

  const filteredTotal = params.status
    ? ((await sql`SELECT COUNT(*)::int AS c FROM purchases WHERE status = ${params.status}`) as {
        c: number;
      }[])[0].c
    : s.total;

  return {
    items,
    total: filteredTotal,
    summary: {
      total: s.total,
      paid: s.paid,
      pending: s.pending,
      paidAmount: Number(s.paid_amount),
    },
  };
}

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
      // Coluna do app (multi-tenant) — adicionada se ainda não existir.
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS app TEXT`;
      // Último erro de provisionamento (pagamento ok, mas criação da conta
      // falhou) — para o painel exibir e permitir reprocessar.
      await sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS provision_error TEXT`;
    })();
  }
  return schemaReady;
}

// ===== Configurações do site (key-value) =====

let settingsSchemaReady: Promise<void> | null = null;
function ensureSettingsSchema(): Promise<void> {
  if (!settingsSchemaReady) {
    const sql = db();
    settingsSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS site_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `;
    })();
  }
  return settingsSchemaReady;
}

export async function getSettings(): Promise<Record<string, string>> {
  await ensureSettingsSchema();
  const sql = db();
  const rows = (await sql`SELECT key, value FROM site_settings`) as {
    key: string;
    value: string | null;
  }[];
  const out: Record<string, string> = {};
  for (const r of rows) if (r.value != null) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSettingsSchema();
  const sql = db();
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export type Purchase = {
  transactionId: string;
  app: string | null;
  email: string | null;
  phone: string | null;
  packageId: string | null;
  packageLabel: string | null;
  amount: number | null;
  username: string | null;
  password: string | null;
  status: string;
  provisioned: boolean;
  provisionError: string | null;
  createdAt: string;
};

type Row = {
  transaction_id: string;
  app: string | null;
  email: string | null;
  phone: string | null;
  package_id: string | null;
  package_label: string | null;
  amount: string | number | null;
  username: string | null;
  password: string | null;
  status: string;
  provisioned: boolean;
  provision_error: string | null;
  created_at: string;
};

function mapRow(r: Row): Purchase {
  return {
    transactionId: r.transaction_id,
    app: r.app ?? null,
    email: r.email,
    phone: r.phone,
    packageId: r.package_id,
    packageLabel: r.package_label,
    amount: r.amount != null ? Number(r.amount) : null,
    username: r.username,
    password: r.password,
    status: r.status,
    provisioned: r.provisioned,
    provisionError: r.provision_error ?? null,
    createdAt: r.created_at,
  };
}

// Registra a compra no momento da criação da cobrança PIX.
export async function savePurchaseInit(p: {
  transactionId: string;
  app?: string;
  email?: string;
  phone?: string;
  packageId: string;
  packageLabel: string;
  amount: number;
}): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    INSERT INTO purchases (transaction_id, app, email, phone, package_id, package_label, amount, status)
    VALUES (${p.transactionId}, ${p.app ?? null}, ${p.email ?? null}, ${p.phone ?? null}, ${p.packageId}, ${p.packageLabel}, ${p.amount}, 'pending')
    ON CONFLICT (transaction_id) DO UPDATE
      SET app = EXCLUDED.app,
          email = EXCLUDED.email,
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

// Grava as credenciais geradas e marca como pago (limpando erro anterior).
export async function saveCredentials(
  transactionId: string,
  username: string,
  password: string,
): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases
      SET username = ${username}, password = ${password}, status = 'paid',
          provision_error = NULL, updated_at = now()
    WHERE transaction_id = ${transactionId}
  `;
}

// Registra que o pagamento foi confirmado, mesmo antes de criar a conta —
// assim dinheiro que entrou nunca fica exibido como "pendente".
export async function markPaid(transactionId: string): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases
      SET status = 'paid', updated_at = now()
    WHERE transaction_id = ${transactionId} AND status <> 'paid'
  `;
}

// Guarda o último erro de provisionamento (ou limpa, com null).
export async function setProvisionError(
  transactionId: string,
  error: string | null,
): Promise<void> {
  await ensureSchema();
  const sql = db();
  await sql`
    UPDATE purchases
      SET provision_error = ${error}, updated_at = now()
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

// ===== Apps (multi-tenant) =====

export type AppRow = {
  slug: string;
  name: string;
  color: string;
  logo_url: string | null;
  access_url: string | null;
  whatsapp: string | null;
  video_id: string | null;
  email_intro: string | null;
  tutorial_url: string | null;
  google_ads_customer_id: string | null;
  active: boolean;
};

export type AppConfig = {
  slug: string;
  name: string;
  color: string;
  logoUrl: string;
  accessUrl: string;
  whatsapp: string;
  videoId: string;
  emailIntro: string;
  tutorialUrl: string;
  googleAdsCustomerId: string;
  active: boolean;
};

function mapApp(r: AppRow): AppConfig {
  return {
    slug: r.slug,
    name: r.name,
    color: r.color || "#1477e1",
    logoUrl: r.logo_url ?? "",
    accessUrl: r.access_url ?? "",
    whatsapp: r.whatsapp ?? "",
    videoId: r.video_id ?? "",
    emailIntro: r.email_intro ?? "",
    tutorialUrl: r.tutorial_url ?? "",
    googleAdsCustomerId: r.google_ads_customer_id ?? "",
    active: r.active,
  };
}

let appsSchemaReady: Promise<void> | null = null;
function ensureAppsSchema(): Promise<void> {
  if (!appsSchemaReady) {
    const sql = db();
    appsSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS apps (
          slug TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#1477e1',
          logo_url TEXT,
          access_url TEXT,
          whatsapp TEXT,
          video_id TEXT,
          email_intro TEXT,
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        )
      `;
      // URL do tutorial (vídeo) enviado no e-mail — adicionada se não existir.
      await sql`ALTER TABLE apps ADD COLUMN IF NOT EXISTS tutorial_url TEXT`;
      // Conta do Google Ads (customer id) associada a este app.
      await sql`ALTER TABLE apps ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT`;
      // Semeia o app xciptv na primeira vez (tabela vazia).
      await sql`
        INSERT INTO apps (slug, name, color, logo_url, video_id)
        SELECT 'xciptv', 'xciptv', '#1477e1', '/logo.png', '9reoiOwB6EI'
        WHERE NOT EXISTS (SELECT 1 FROM apps)
      `;
      // Semeia o app funplays (idempotente): só cria se ainda não existir,
      // sem sobrescrever edições feitas depois pelo painel.
      await sql`
        INSERT INTO apps (slug, name, color, logo_url)
        SELECT 'funplays', 'FunPlays', '#1477e1', 'https://funplaysapp.com/logo.png'
        WHERE NOT EXISTS (SELECT 1 FROM apps WHERE slug = 'funplays')
      `;
    })();
  }
  return appsSchemaReady;
}

export async function listApps(activeOnly = false): Promise<AppConfig[]> {
  await ensureAppsSchema();
  const sql = db();
  const rows = (
    activeOnly
      ? ((await sql`SELECT * FROM apps WHERE active = TRUE ORDER BY created_at`) as AppRow[])
      : ((await sql`SELECT * FROM apps ORDER BY created_at`) as AppRow[])
  ).map(mapApp);
  return rows;
}

export async function getApp(slug: string): Promise<AppConfig | null> {
  await ensureAppsSchema();
  const sql = db();
  const rows = (await sql`
    SELECT * FROM apps WHERE slug = ${slug} LIMIT 1
  `) as AppRow[];
  return rows[0] ? mapApp(rows[0]) : null;
}

export async function upsertApp(a: {
  slug: string;
  name: string;
  color: string;
  logoUrl?: string;
  accessUrl?: string;
  whatsapp?: string;
  videoId?: string;
  emailIntro?: string;
  tutorialUrl?: string;
  googleAdsCustomerId?: string;
  active: boolean;
}): Promise<void> {
  await ensureAppsSchema();
  const sql = db();
  await sql`
    INSERT INTO apps (slug, name, color, logo_url, access_url, whatsapp, video_id, email_intro, tutorial_url, google_ads_customer_id, active, updated_at)
    VALUES (${a.slug}, ${a.name}, ${a.color}, ${a.logoUrl ?? null}, ${a.accessUrl ?? null}, ${a.whatsapp ?? null}, ${a.videoId ?? null}, ${a.emailIntro ?? null}, ${a.tutorialUrl ?? null}, ${a.googleAdsCustomerId ?? null}, ${a.active}, now())
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          color = EXCLUDED.color,
          logo_url = EXCLUDED.logo_url,
          access_url = EXCLUDED.access_url,
          whatsapp = EXCLUDED.whatsapp,
          video_id = EXCLUDED.video_id,
          email_intro = EXCLUDED.email_intro,
          tutorial_url = EXCLUDED.tutorial_url,
          google_ads_customer_id = EXCLUDED.google_ads_customer_id,
          active = EXCLUDED.active,
          updated_at = now()
  `;
}

export async function deleteApp(slug: string): Promise<void> {
  await ensureAppsSchema();
  const sql = db();
  await sql`DELETE FROM apps WHERE slug = ${slug}`;
}

// Vendas pagas de um app nos últimos N dias (para calcular o ROAS real
// cruzando com o gasto do Google Ads).
export async function getAppSalesSummary(
  app: string,
  days = 30,
): Promise<{ count: number; revenue: number }> {
  await ensureSchema();
  const sql = db();
  const rows = (await sql`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(amount), 0) AS revenue
    FROM purchases
    WHERE app = ${app}
      AND status IN ('paid', 'approved')
      AND created_at >= now() - (${days} || ' days')::interval
  `) as { count: number; revenue: string | number }[];
  const r = rows[0];
  return { count: r?.count ?? 0, revenue: Number(r?.revenue ?? 0) };
}

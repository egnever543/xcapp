// Integração com a API FastDePix (cobrança PIX).
// Docs: https://fastdepix.space/api/docs.php

const BASE_URL =
  process.env.FASTDEPIX_BASE_URL ?? "https://fastdepix.space/api/v1";
const API_KEY = process.env.FASTDEPIX_API_KEY;

export type PixTransaction = {
  id: number;
  amount: number;
  status: string;
  qrCode: string | null; // URL da imagem do QR Code
  qrCodeText: string | null; // copia-e-cola
  expiresAt: string | null;
};

type RawTransaction = {
  id: number;
  amount: number | string;
  status: string;
  qr_code?: string | null;
  qr_code_text?: string | null;
  qr_code_expires_at?: string | null;
};

function ensureKey() {
  if (!API_KEY) throw new Error("FASTDEPIX_API_KEY não configurada.");
}

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function mapTx(d: RawTransaction): PixTransaction {
  return {
    id: d.id,
    amount: Number(d.amount),
    status: String(d.status),
    qrCode: d.qr_code ?? null,
    qrCodeText: d.qr_code_text ?? null,
    expiresAt: d.qr_code_expires_at ?? null,
  };
}

// Cria uma cobrança PIX. O provedor (fastpay/fastflow/depix) é definido pela
// própria chave API — não é enviado no corpo.
export async function createTransaction(params: {
  amount: number;
  phone?: string;
  name?: string;
  notificationUrl?: string;
}): Promise<PixTransaction> {
  ensureKey();

  const body: Record<string, unknown> = { amount: params.amount };
  if (params.phone) body.payer_phone = params.phone.replace(/\D/g, "");
  if (params.name) body.user = { name: params.name };
  if (params.notificationUrl) body.notification_url = params.notificationUrl;

  const res = await fetch(`${BASE_URL}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message ?? "Falha ao criar a cobrança PIX.");
  }
  return mapTx(json.data);
}

// Consulta o status de uma cobrança pelo id.
export async function getTransaction(
  id: number | string,
): Promise<PixTransaction> {
  ensureKey();

  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message ?? "Falha ao consultar a cobrança.");
  }
  return mapTx(json.data);
}

// ===== Admin: listagem e relatório de transações =====

export type TxListItem = {
  id: number;
  amount: number;
  status: string;
  payerPhone: string | null;
  userName: string | null;
  createdAt: string | null;
};

export type TxListResult = {
  items: TxListItem[];
  total: number;
  page: number;
  totalPages: number;
};

// Lista transações com filtros (para o painel admin).
export async function listTransactions(params: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<TxListResult> {
  ensureKey();
  const url = new URL(`${BASE_URL}/transactions`);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.dateFrom) url.searchParams.set("date_from", params.dateFrom);
  if (params.dateTo) url.searchParams.set("date_to", params.dateTo);
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("limit", String(params.limit ?? 20));

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json?.success) {
    throw new Error(json?.message ?? "Falha ao listar transações.");
  }

  const data = json.data ?? {};
  const list = Array.isArray(data.transactions) ? data.transactions : [];
  return {
    items: list.map(
      (t: {
        id: number;
        amount: number | string;
        status: string;
        payer_phone?: string | null;
        user?: { name?: string | null };
        created_at?: string | null;
      }) => ({
        id: t.id,
        amount: Number(t.amount),
        status: String(t.status),
        payerPhone: t.payer_phone ?? null,
        userName: t.user?.name ?? null,
        createdAt: t.created_at ?? null,
      }),
    ),
    total: data.pagination?.total ?? list.length,
    page: data.pagination?.current_page ?? 1,
    totalPages: data.pagination?.total_pages ?? 1,
  };
}

export type TxReport = {
  totalTransactions: number;
  totalAmount: number;
  paidTransactions: number;
  paidAmount: number;
  pendingTransactions: number;
  expiredTransactions: number;
  averageAmount: number;
};

// Resumo do período (GET /reports/transactions).
export async function getTransactionsReport(params: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<TxReport | null> {
  ensureKey();
  const url = new URL(`${BASE_URL}/reports/transactions`);
  if (params.dateFrom) url.searchParams.set("date_from", params.dateFrom);
  if (params.dateTo) url.searchParams.set("date_to", params.dateTo);

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) return null;

  const s = json.data?.summary ?? {};
  return {
    totalTransactions: Number(s.total_transactions ?? 0),
    totalAmount: Number(s.total_amount ?? 0),
    paidTransactions: Number(s.paid_transactions ?? 0),
    paidAmount: Number(s.paid_amount ?? 0),
    pendingTransactions: Number(s.pending_transactions ?? 0),
    expiredTransactions: Number(s.expired_transactions ?? 0),
    averageAmount: Number(s.average_amount ?? 0),
  };
}

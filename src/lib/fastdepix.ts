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

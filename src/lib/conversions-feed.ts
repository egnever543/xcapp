import crypto from "crypto";
import type { PaidConversion } from "@/lib/db";

// Gera o CSV de conversões offline do Google Ads a partir das vendas pagas.
// Suporta tanto correspondência por GCLID (clique) quanto por conversões
// otimizadas para leads (e-mail/telefone com hash SHA-256).

// SHA-256 em hex (minúsculo) do valor já normalizado.
function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// Normaliza e faz o hash do e-mail (minúsculo, sem espaços).
function hashEmail(email: string | null): string {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return "";
  return sha256(e);
}

// Normaliza o telefone para E.164 (Brasil, +55) e faz o hash.
function hashPhone(phone: string | null): string {
  let d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return sha256(`+${d}`);
}

// Horário no formato aceito pelo Google Ads: "yyyy-MM-dd HH:mm:ss-03:00"
// (horário de Brasília; hoje o Brasil não tem horário de verão).
function conversionTime(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}-03:00`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Monta o CSV. `conversionName` é o nome da ação de conversão no Google Ads
// (pode ser mapeado na etapa de importação, então é opcional aqui).
export function buildConversionsCsv(
  rows: PaidConversion[],
  conversionName = "",
): string {
  const header = [
    "Google Click ID",
    "Conversion Name",
    "Conversion Time",
    "Conversion Value",
    "Conversion Currency",
    "Email",
    "Phone Number",
    "Order ID",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const cols = [
      r.gclid ?? "",
      conversionName,
      conversionTime(r.createdAt),
      (r.amount ?? 0).toFixed(2),
      "BRL",
      hashEmail(r.email),
      hashPhone(r.phone),
      r.transactionId,
    ].map((c) => csvCell(String(c)));
    lines.push(cols.join(","));
  }
  // CRLF é o mais compatível com a importação do Google.
  return lines.join("\r\n") + "\r\n";
}

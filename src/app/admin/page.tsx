import {
  listPurchases,
  listApps,
  hasDb,
  type Purchase,
  type AppConfig,
} from "@/lib/db";
import { loadSettings, getOutboundWebhook } from "@/lib/settings";
import { ResendEmailButton } from "./resend-button";
import { ProvisionButton } from "./provision-button";
import { SettingsForm } from "./settings-form";
import { WebhookForm } from "./webhook-form";
import { TutorialsForm } from "./tutorials-form";
import { AppsManager } from "./apps-manager";
import { GoogleAdsPanel } from "./google-ads-panel";
import { BotbotTest } from "./botbot-test";
import { getConnectionStatus } from "@/lib/google-ads";
import { AutoRefresh } from "./auto-refresh";
import { SalesNotifier } from "./sales-notifier";
import { AdminTheme } from "./admin-theme";

export const dynamic = "force-dynamic";

function brl(value: number | null): string {
  return (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  // Formata sempre no horário de Brasília (o servidor roda em UTC).
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Normaliza o telefone do cliente para um link do WhatsApp (wa.me). Assume
// Brasil: adiciona o DDI 55 quando o número tem só DDD + número.
function waLink(phone: string | null): { href: string; label: string } | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  return { href: `https://wa.me/${digits}`, label: phone };
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  expired: "bg-zinc-200 text-zinc-600 dark:text-zinc-300",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
};

type SearchParams = { status?: string; page?: string };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageSize = 20;

  let items: Purchase[] = [];
  let total = 0;
  let paidAmount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let error: string | null = null;

  if (!hasDb()) {
    error = "Banco não configurado (DATABASE_URL ausente).";
  } else {
    try {
      const res = await listPurchases({
        status: status || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      items = res.items;
      total = res.total;
      paidAmount = res.summary.paidAmount;
      paidCount = res.summary.paid;
      pendingCount = res.summary.pending;
    } catch (err) {
      error = (err as Error).message ?? "Falha ao carregar os dados.";
    }
  }

  const settings = await loadSettings();
  const webhook = await getOutboundWebhook();
  let apps: AppConfig[] = [];
  if (hasDb()) {
    try {
      apps = await listApps(false);
    } catch {
      apps = [];
    }
  }
  const googleStatus = await getConnectionStatus().catch(() => ({
    connected: false,
    email: "",
    configured: false,
  }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cards = [
    { label: "Recebido (pago)", value: brl(paidAmount) },
    { label: "Vendas pagas", value: String(paidCount) },
    { label: "Pendentes", value: String(pendingCount) },
    {
      label: "Ticket médio",
      value: brl(paidCount ? paidAmount / paidCount : 0),
    },
  ];

  return (
    <AdminTheme>
      <header className="border-b border-zinc-200 bg-brand-black text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            xc<span className="text-brand-blue">iptv</span> · Admin
          </span>
          <span className="text-sm text-zinc-300">Registro de compras</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {c.label}
              </p>
              <p className="mt-2 text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Configuração da tag de conversão */}
        <SettingsForm
          googleAdsId={settings.googleAdsId}
          conversionLabel={settings.conversionLabel}
        />

        {/* Webhook de eventos */}
        <WebhookForm url={webhook.url} hasSecret={!!webhook.secret} />

        {/* Tutoriais de login (e-mail + WhatsApp) */}
        <TutorialsForm
          remoteUrl={settings.tutorialRemoteUrl}
          tvUrl={settings.tutorialTvUrl}
        />

        {/* Teste de WhatsApp (BotBot) */}
        <BotbotTest />

        {/* Gestão de apps (multi-tenant) */}
        <AppsManager apps={apps} />

        {/* Google Ads — desempenho e gestão por app */}
        <GoogleAdsPanel
          status={googleStatus}
          apps={apps.map((a) => ({
            slug: a.slug,
            name: a.name,
            googleAdsCustomerId: a.googleAdsCustomerId,
          }))}
        />

        {/* Histórico de vendas — atualização automática + alertas */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AutoRefresh />
          <SalesNotifier
            items={items.map((p) => ({
              transactionId: p.transactionId,
              email: p.email,
              amount: p.amount,
              status: p.status,
              createdAt: p.createdAt,
            }))}
          />
        </div>

        {/* Filtro */}
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Todos</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="expired">Expirado</option>
              <option value="cancelled">Cancelado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark"
          >
            Filtrar
          </button>
        </form>

        {/* Tabela */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Pacote</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Nenhuma compra registrada ainda.
                  </td>
                </tr>
              )}
              {!error &&
                items.map((p) => (
                  <tr key={p.transactionId} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="block">{p.email ?? "—"}</span>
                      {(() => {
                        const wa = waLink(p.phone);
                        return wa ? (
                          <a
                            href={wa.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:underline dark:text-green-400"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="h-3.5 w-3.5 fill-current"
                            >
                              <path d="M17.5 14.4c-.3-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38s1.02 2.76 1.17 2.95c.15.19 2.02 3.08 4.9 4.32.68.29 1.21.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.06-1.33A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
                            </svg>
                            {wa.label}
                          </a>
                        ) : (
                          <span className="mt-0.5 block text-xs text-zinc-400">
                            sem WhatsApp
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">{p.packageLabel ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{brl(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[p.status] ?? "bg-zinc-100 text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.username ?? "—"}
                      {!p.provisioned &&
                        (p.status === "paid" || p.status === "approved") && (
                          <span
                            title={p.provisionError ?? undefined}
                            className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                          >
                            ⚠ acesso não criado
                          </span>
                        )}
                      {p.provisionError && (
                        <span className="mt-1 block max-w-[260px] text-[11px] leading-tight text-red-600">
                          {p.provisionError}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {!p.provisioned &&
                          (p.status === "paid" || p.status === "approved") && (
                            <ProvisionButton transactionId={p.transactionId} />
                          )}
                        <ResendEmailButton
                          transactionId={p.transactionId}
                          disabled={!p.email || !p.username}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
            <span>
              Página {page} de {totalPages} · {total} no total
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ status, page: String(page - 1) }).toString()}`}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ status, page: String(page + 1) }).toString()}`}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Próxima
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </AdminTheme>
  );
}

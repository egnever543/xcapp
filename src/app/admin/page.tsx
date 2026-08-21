import {
  listPurchases,
  listApps,
  hasDb,
  type Purchase,
  type AppConfig,
} from "@/lib/db";
import { loadSettings, getOutboundWebhook } from "@/lib/settings";
import { ResendEmailButton } from "./resend-button";
import { SettingsForm } from "./settings-form";
import { WebhookForm } from "./webhook-form";
import { AppsManager } from "./apps-manager";
import { AutoRefresh } from "./auto-refresh";
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
  return d.toLocaleString("pt-BR");
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

        {/* Gestão de apps (multi-tenant) */}
        <AppsManager apps={apps} />

        {/* Histórico de vendas — atualização automática */}
        <div className="mt-8">
          <AutoRefresh />
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
                    <td className="px-4 py-3">{p.email ?? "—"}</td>
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
                    <td className="px-4 py-3">{p.username ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ResendEmailButton
                        transactionId={p.transactionId}
                        disabled={!p.email || !p.username}
                      />
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

import {
  getSitePurchases,
  type TxListItem,
  type TxReport,
} from "@/lib/fastdepix";

// Página dinâmica (usa filtros da query).
export const dynamic = "force-dynamic";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  approved: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  expired: "bg-zinc-200 text-zinc-600",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-700",
};

type SearchParams = {
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  let report: TxReport | null = null;
  let items: TxListItem[] = [];
  let totalPages = 1;
  let total = 0;
  let error: string | null = null;

  try {
    const purchases = await getSitePurchases({
      status: status || undefined,
      dateFrom: from || undefined,
      dateTo: to || undefined,
    });
    report = purchases.summary;
    total = purchases.items.length;
    const pageSize = 20;
    totalPages = Math.max(1, Math.ceil(total / pageSize));
    items = purchases.items.slice((page - 1) * pageSize, page * pageSize);
  } catch (err) {
    error = (err as Error).message ?? "Falha ao carregar os dados.";
  }

  const cards = [
    { label: "Recebido (pago)", value: report ? brl(report.paidAmount) : "—" },
    { label: "Vendas pagas", value: report ? String(report.paidTransactions) : "—" },
    { label: "Pendentes", value: report ? String(report.pendingTransactions) : "—" },
    { label: "Ticket médio", value: report ? brl(report.averageAmount) : "—" },
  ];

  return (
    <div className="flex flex-1 flex-col bg-white text-brand-black">
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
            <div
              key={c.label}
              className="rounded-2xl border border-zinc-200 p-5"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {c.label}
              </p>
              <p className="mt-2 text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <form
          method="get"
          className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="expired">Expirado</option>
              <option value="cancelled">Cancelado</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">De</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600">Até</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark"
          >
            Filtrar
          </button>
        </form>

        {/* Tabela */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Telefone</th>
                <th className="px-4 py-3 font-medium">Nome</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!error && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              )}
              {!error &&
                items.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-zinc-500">{t.id}</td>
                    <td className="px-4 py-3">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{brl(t.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[t.status] ?? "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{t.payerPhone ?? "—"}</td>
                    <td className="px-4 py-3">{t.userName ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
            <span>
              Página {page} de {totalPages} · {total} no total
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`?${new URLSearchParams({ status, from, to, page: String(page - 1) }).toString()}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
                >
                  Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`?${new URLSearchParams({ status, from, to, page: String(page + 1) }).toString()}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
                >
                  Próxima
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

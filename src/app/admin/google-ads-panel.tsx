"use client";

import { useState, useTransition } from "react";
import {
  loadCampaigns,
  updateCampaignStatus,
  updateCampaignBudget,
  disconnectGoogleAds,
  type CampaignsResult,
} from "./actions";
import type { CampaignMetrics } from "@/lib/google-ads";

type AppLite = { slug: string; name: string; googleAdsCustomerId: string };
type Status = { connected: boolean; email: string; configured: boolean };

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function int(v: number): string {
  return Math.round(v).toLocaleString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  ENABLED: "Ativa",
  PAUSED: "Pausada",
  REMOVED: "Removida",
};

// Bloco de um app: carrega campanhas sob demanda e permite pausar/ativar e
// ajustar orçamento (Fase 2).
function AppCampaigns({ app }: { app: AppLite }) {
  const [days, setDays] = useState(30);
  const [loading, startLoad] = useTransition();
  const [res, setRes] = useState<CampaignsResult | null>(null);

  const load = (d = days) => {
    startLoad(async () => {
      const r = await loadCampaigns(app.slug, d);
      setRes(r);
    });
  };

  const spend = (res?.campaigns ?? []).reduce((s, c) => s + c.cost, 0);
  const revenue = res?.sales?.revenue ?? 0;
  const roas = spend > 0 ? revenue / spend : 0;

  return (
    <details className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
        <span>
          {app.name}{" "}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            · conta {app.googleAdsCustomerId}
          </span>
        </span>
        <span className="text-xs text-brand-blue">abrir</span>
      </summary>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg bg-brand-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {loading ? "Carregando…" : res ? "Atualizar" : "Carregar campanhas"}
          </button>
        </div>

        {res && !res.ok && (
          <p className="mt-3 text-sm font-medium text-red-600">{res.error}</p>
        )}

        {res?.ok && (
          <>
            {/* Resumo: gasto x vendas reais (ROAS real) */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gasto (Ads)
                </p>
                <p className="mt-1 font-bold">{brl(spend)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Vendas reais (site)
                </p>
                <p className="mt-1 font-bold">{brl(revenue)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Vendas (qtd)
                </p>
                <p className="mt-1 font-bold">{int(res.sales?.count ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  ROAS real
                </p>
                <p className="mt-1 font-bold">
                  {spend > 0 ? `${roas.toFixed(2)}x` : "—"}
                </p>
              </div>
            </div>

            {res.campaigns && res.campaigns.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Campanha</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Gasto</th>
                      <th className="py-2 pr-3 font-medium">Cliques</th>
                      <th className="py-2 pr-3 font-medium">Conv.</th>
                      <th className="py-2 pr-3 font-medium">Orç./dia</th>
                      <th className="py-2 pr-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.campaigns.map((c) => (
                      <CampaignRow
                        key={c.id}
                        app={app}
                        c={c}
                        onChanged={() => load()}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Nenhuma campanha no período.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

// Linha de campanha com ações da Fase 2.
function CampaignRow({
  app,
  c,
  onChanged,
}: {
  app: AppLite;
  c: CampaignMetrics;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState(String(c.budgetDaily.toFixed(2)));

  const toggle = () => {
    setErr(null);
    start(async () => {
      const r = await updateCampaignStatus(
        app.slug,
        c.id,
        c.status === "ENABLED" ? "PAUSED" : "ENABLED",
      );
      if (!r.ok) setErr(r.error ?? "Falha.");
      else onChanged();
    });
  };

  const saveBudget = () => {
    if (!c.budgetResource) return;
    setErr(null);
    start(async () => {
      const r = await updateCampaignBudget(
        app.slug,
        c.budgetResource!,
        Number(budget.replace(",", ".")),
      );
      if (!r.ok) setErr(r.error ?? "Falha.");
      else {
        setEditing(false);
        onChanged();
      }
    });
  };

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="py-2 pr-3">{c.name}</td>
      <td className="py-2 pr-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            c.status === "ENABLED"
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {STATUS_LABEL[c.status] ?? c.status}
        </span>
      </td>
      <td className="py-2 pr-3">{brl(c.cost)}</td>
      <td className="py-2 pr-3">{int(c.clicks)}</td>
      <td className="py-2 pr-3">{int(c.conversions)}</td>
      <td className="py-2 pr-3">
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={saveBudget}
              disabled={pending}
              className="rounded bg-brand-blue px-2 py-1 text-xs text-white disabled:opacity-60"
            >
              ok
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!c.budgetResource}
            className="underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
            title={c.budgetResource ? "Editar orçamento" : "Sem orçamento editável"}
          >
            {brl(c.budgetDaily)}
          </button>
        )}
      </td>
      <td className="py-2 pr-3">
        <button
          type="button"
          onClick={toggle}
          disabled={pending || c.status === "REMOVED"}
          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {pending
            ? "…"
            : c.status === "ENABLED"
              ? "Pausar"
              : "Ativar"}
        </button>
        {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
      </td>
    </tr>
  );
}

export function GoogleAdsPanel({
  status,
  apps,
}: {
  status: Status;
  apps: AppLite[];
}) {
  const [disc, startDisc] = useTransition();
  const withAccount = apps.filter((a) => a.googleAdsCustomerId);

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Google Ads</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Acompanhe o desempenho das campanhas por app e gerencie orçamento e
            status. O ROAS real cruza o gasto com as suas vendas.
          </p>
        </div>
        {status.connected ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-600">
              Conectado{status.email ? ` · ${status.email}` : ""}
            </span>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/google-ads/connect"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Reconectar
            </a>
            <button
              type="button"
              onClick={() => startDisc(async () => void (await disconnectGoogleAds()))}
              disabled={disc}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
            >
              Desconectar
            </button>
          </div>
        ) : status.configured ? (
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/google-ads/connect"
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
          >
            Conectar Google Ads
          </a>
        ) : (
          <span className="max-w-sm text-sm text-amber-600">
            Faltam variáveis de ambiente do Google (client id/secret e developer
            token).
          </span>
        )}
      </div>

      {status.connected && (
        <div className="mt-5 space-y-3">
          {withAccount.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nenhum app tem a conta do Google Ads definida. Edite um app em
              &quot;Apps&quot; e preencha o customer id.
            </p>
          ) : (
            withAccount.map((a) => <AppCampaigns key={a.slug} app={a} />)
          )}
        </div>
      )}
    </section>
  );
}

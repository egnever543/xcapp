"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./actions";

const initial: SettingsState = {};

// Formulário de configuração da tag de conversão do Google Ads.
export function SettingsForm({
  googleAdsId,
  conversionLabel,
}: {
  googleAdsId: string;
  conversionLabel: string;
}) {
  const [state, action, pending] = useActionState(saveSettings, initial);

  return (
    <form
      action={action}
      className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">Tag de conversão (Google Ads)</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Preencha para enviar as vendas ao Google Ads. O evento de conversão é
        disparado automaticamente quando o pagamento é confirmado.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">AW ID (tag base)</span>
          <input
            name="google_ads_id"
            defaultValue={googleAdsId}
            placeholder="AW-16999732658"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Rótulo da conversão</span>
          <input
            name="google_conversion_label"
            defaultValue={conversionLabel}
            placeholder="AbC-D_efGhIjKl"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state.ok && (
          <span className="text-sm font-medium text-green-700">Salvo ✓</span>
        )}
        {state.error && (
          <span className="text-sm font-medium text-red-600">
            {state.error}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        O <strong>rótulo</strong> é a parte após a barra no <code>send_to</code>{" "}
        da sua conversão (ex.: em <code>AW-16999732658/AbC-D_efGhIjKl</code>, o
        rótulo é <code>AbC-D_efGhIjKl</code>). Encontre em Google Ads → Metas →
        Conversões.
      </p>
    </form>
  );
}

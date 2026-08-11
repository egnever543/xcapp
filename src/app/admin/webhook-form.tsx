"use client";

import { useActionState, useState, useTransition } from "react";
import { saveWebhook, testWebhook, type SettingsState } from "./actions";

const initial: SettingsState = {};

// Configuração do webhook de saída (envio de eventos, ex.: sale.completed).
export function WebhookForm({
  url,
  hasSecret,
}: {
  url: string;
  hasSecret: boolean;
}) {
  const [state, action, saving] = useActionState(saveWebhook, initial);
  const [testing, startTest] = useTransition();
  const [testState, setTestState] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const onTest = () => {
    startTest(async () => {
      const r = await testWebhook();
      setTestState(r.ok ? "ok" : "error");
      setTestMsg(r.error ?? null);
      setTimeout(() => setTestState("idle"), 5000);
    });
  };

  return (
    <form
      action={action}
      className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">Webhook de eventos</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        O site envia um POST para esta URL quando uma venda é concluída
        (evento <code>sale.completed</code>). Deixe em branco para desativar.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">URL (https)</span>
          <input
            name="outbound_webhook_url"
            defaultValue={url}
            placeholder="https://seu-sistema.com/webhook"
            className="w-80 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Segredo (opcional)
          </span>
          <input
            name="outbound_webhook_secret"
            type="password"
            defaultValue=""
            placeholder={hasSecret ? "•••••• (deixe em branco p/ manter)" : ""}
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="rounded-lg border border-zinc-300 px-5 py-2 font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {testing ? "Enviando…" : "Enviar teste"}
        </button>
        {state.ok && (
          <span className="text-sm font-medium text-green-700">Salvo ✓</span>
        )}
        {state.error && (
          <span className="text-sm font-medium text-red-600">{state.error}</span>
        )}
        {testState === "ok" && (
          <span className="text-sm font-medium text-green-700">
            Teste enviado ✓
          </span>
        )}
        {testState === "error" && (
          <span className="text-sm font-medium text-red-600">
            {testMsg ?? "Falhou"}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Se definir um segredo, cada envio inclui o header{" "}
        <code>X-Signature: sha256=HMAC(corpo)</code> para você validar a origem.
        Salve a URL antes de usar o &quot;Enviar teste&quot;.
      </p>
    </form>
  );
}

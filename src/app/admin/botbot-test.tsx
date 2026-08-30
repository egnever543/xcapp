"use client";

import { useState, useTransition } from "react";
import { testBotbot } from "./actions";

// Teste de envio pelo WhatsApp (BotBot), mostrando a resposta crua para
// diagnóstico (status HTTP + corpo).
export function BotbotTest() {
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    status: number;
    body?: string;
    error?: string;
  } | null>(null);

  const run = () => {
    setResult(null);
    start(async () => {
      const r = await testBotbot(phone);
      setResult(r);
    });
  };

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
      <h2 className="text-lg font-semibold">WhatsApp (BotBot)</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Envia o Pix copia e cola ao gerar a cobrança. Teste aqui o envio para um
        número (com DDD) e veja a resposta da BotBot.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Número de teste
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending || !phone}
          className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar teste"}
        </button>
        {result && (
          <span
            className={`text-sm font-medium ${
              result.ok ? "text-green-700" : "text-red-600"
            }`}
          >
            {result.ok ? "Enviado ✓" : result.error ?? `Falhou (HTTP ${result.status})`}
          </span>
        )}
      </div>

      {result && (result.body || result.status) ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {`HTTP ${result.status}\n${result.body ?? ""}`}
        </pre>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Lembre-se: variáveis novas na Vercel só valem após um novo deploy. Um
        HTTP 200 com &quot;skipped&quot; costuma indicar dispositivo do WhatsApp
        desconectado ou número sem WhatsApp.
      </p>
    </section>
  );
}

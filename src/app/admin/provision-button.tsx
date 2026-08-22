"use client";

import { useState, useTransition } from "react";
import { retryProvision } from "./actions";

// Botão por compra: (re)processa o provisionamento — cria a conta no painel e
// envia o e-mail. Ao falhar, mostra o motivo real retornado pelo painel.
export function ProvisionButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = () => {
    startTransition(async () => {
      const r = await retryProvision(transactionId);
      setState(r.ok ? "ok" : "error");
      setMsg(r.error ?? null);
      if (r.ok) setTimeout(() => setState("idle"), 4000);
    });
  };

  const label = pending
    ? "Provisionando…"
    : state === "ok"
      ? "Liberado ✓"
      : "Provisionar";

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title={msg ?? undefined}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          state === "ok"
            ? "border-green-300 text-green-700"
            : state === "error"
              ? "border-red-300 text-red-700"
              : "border-brand-blue/40 text-brand-blue hover:bg-brand-blue/10"
        }`}
      >
        {label}
      </button>
      {state === "error" && msg && (
        <span className="max-w-[220px] text-[11px] leading-tight text-red-600">
          {msg}
        </span>
      )}
    </span>
  );
}

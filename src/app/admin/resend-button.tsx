"use client";

import { useState, useTransition } from "react";
import { resendEmail } from "./actions";

// Botão por compra: reenvia o e-mail de acesso usando os dados salvos.
export function ResendEmailButton({
  transactionId,
  disabled,
}: {
  transactionId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = () => {
    startTransition(async () => {
      const r = await resendEmail(transactionId);
      setState(r.ok ? "ok" : "error");
      setMsg(r.error ?? null);
      setTimeout(() => setState("idle"), 4000);
    });
  };

  const label = pending
    ? "Enviando…"
    : state === "ok"
      ? "Enviado ✓"
      : state === "error"
        ? "Falhou ✗"
        : "Reenviar e-mail";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={msg ?? undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        state === "ok"
          ? "border-green-300 text-green-700"
          : state === "error"
            ? "border-red-300 text-red-700"
            : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}

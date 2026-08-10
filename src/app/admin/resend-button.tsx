"use client";

import { useState } from "react";

// Botão por transação para disparar um e-mail de TESTE (valida a pipeline do
// Resend). Pergunta o destinatário e envia com credenciais de exemplo — a
// FastDePix não guarda o e-mail/login/senha reais da compra.
export function ResendEmailButton({ txId }: { txId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">(
    "idle",
  );

  const onClick = async () => {
    const email = window.prompt("Enviar e-mail de teste para qual endereço?");
    if (!email) return;
    setState("sending");
    try {
      const r = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: `teste-${txId}`,
          password: "senha-de-teste",
        }),
      });
      setState(r.ok ? "ok" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 4000);
  };

  const label =
    state === "sending"
      ? "Enviando…"
      : state === "ok"
        ? "Enviado ✓"
        : state === "error"
          ? "Falhou ✗"
          : "Testar e-mail";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "sending"}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
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

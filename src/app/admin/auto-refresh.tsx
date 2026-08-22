"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Recarrega os dados do servidor (compras + resumo) em intervalo fixo, para
// acompanhar as vendas em tempo real. Usa router.refresh(): re-executa os
// componentes de servidor sem recarregar a página nem perder o que estiver
// digitado nos formulários. Pausa automaticamente quando a aba fica oculta.
const INTERVAL_MS = 15000;

export function AutoRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [last, setLast] = useState<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(new Date());
    };
    const id = setInterval(tick, INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, router]);

  return (
    <div className="mb-4 flex items-center gap-3 text-sm">
      <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
        <span
          className={`h-2 w-2 rounded-full ${
            enabled ? "animate-pulse bg-green-500" : "bg-zinc-400"
          }`}
        />
        {enabled ? "Ao vivo · atualiza a cada 15s" : "Atualização pausada"}
      </span>
      {last && (
        <span className="text-xs text-zinc-400">
          última: {last.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </span>
      )}
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="rounded-lg border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {enabled ? "Pausar" : "Retomar"}
      </button>
      <button
        type="button"
        onClick={() => {
          router.refresh();
          setLast(new Date());
        }}
        className="rounded-lg border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Atualizar agora
      </button>
    </div>
  );
}

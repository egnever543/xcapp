"use client";

import { useEffect, useRef, useState } from "react";

// Item mínimo que o notificador precisa para detectar novas cobranças e
// pagamentos entre as atualizações automáticas do painel.
export type NotifierItem = {
  transactionId: string;
  email: string | null;
  amount: number | null;
  status: string;
  createdAt: string;
};

type Toast = {
  key: number;
  kind: "gerada" | "paga";
  email: string | null;
  amount: number | null;
};

const RECENT_MS = 3 * 60 * 1000; // só alerta cobranças criadas nos últimos 3 min
const SOUND_KEY = "admin_sound_on";

function isPaid(status: string): boolean {
  return status === "paid" || status === "approved";
}

function brl(v: number | null): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Detecta, a cada atualização do painel, cobranças recém-geradas e pagamentos
// recebidos, exibindo um popup e tocando um som. O som é sintetizado via Web
// Audio (sem arquivo); pode ser ligado/desligado e a preferência é salva.
export function SalesNotifier({ items }: { items: NotifierItem[] }) {
  const prevRef = useRef<Map<string, string> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const keyRef = useRef(0);

  // Carrega a preferência de som (uma vez).
  useEffect(() => {
    try {
      const v = localStorage.getItem(SOUND_KEY);
      if (v === "0") setSoundOn(false);
    } catch {
      // ignore
    }
  }, []);

  const setSound = (on: boolean) => {
    setSoundOn(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
    if (on) primeAudio();
  };

  // Cria/retoma o AudioContext (precisa de um gesto do usuário para liberar
  // o áudio nos navegadores).
  const primeAudio = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    try {
      if (!audioRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) return null;
        audioRef.current = new Ctx();
      }
      if (audioRef.current.state === "suspended") {
        void audioRef.current.resume();
      }
      return audioRef.current;
    } catch {
      return null;
    }
  };

  const beep = (kind: "gerada" | "paga") => {
    const ctx = primeAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // "gerada": um toque suave; "paga": dois toques ascendentes (comemorativo).
    const notes = kind === "paga" ? [660, 880, 1046] : [523, 392];
    notes.forEach((freq, i) => {
      const t = now + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  };

  const pushToast = (kind: "gerada" | "paga", it: NotifierItem) => {
    const key = ++keyRef.current;
    setToasts((prev) => [
      ...prev,
      { key, kind, email: it.email, amount: it.amount },
    ]);
    // Remove sozinho após 8s.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== key));
    }, 8000);
  };

  // Diferença entre a lista anterior e a atual a cada atualização.
  useEffect(() => {
    const prev = prevRef.current;
    const events: { kind: "gerada" | "paga"; item: NotifierItem }[] = [];

    if (prev) {
      for (const it of items) {
        const before = prev.get(it.transactionId);
        const paidNow = isPaid(it.status);
        const recent =
          Date.now() - new Date(it.createdAt).getTime() < RECENT_MS;
        if (before === undefined) {
          // Cobrança que não estava na lista anterior: só alerta se for recente
          // (evita disparos ao paginar/filtrar e ver registros antigos).
          if (recent) events.push({ kind: paidNow ? "paga" : "gerada", item: it });
        } else if (!isPaid(before) && paidNow) {
          // Transição para pago.
          events.push({ kind: "paga", item: it });
        }
      }
    }

    // Atualiza o snapshot.
    const next = new Map<string, string>();
    for (const it of items) next.set(it.transactionId, it.status);
    prevRef.current = next;

    if (events.length) {
      for (const e of events) {
        pushToast(e.kind, e.item);
      }
      if (soundOn) {
        // Prioriza o som de pagamento se houver algum.
        beep(events.some((e) => e.kind === "paga") ? "paga" : "gerada");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <>
      {/* Controle de som */}
      <button
        type="button"
        onClick={() => setSound(!soundOn)}
        title={soundOn ? "Alertas sonoros ligados" : "Alertas sonoros desligados"}
        className="rounded-lg border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {soundOn ? "🔔 Som ligado" : "🔕 Som desligado"}
      </button>

      {/* Pilha de popups */}
      <div className="pointer-events-none fixed top-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              setToasts((prev) => prev.filter((x) => x.key !== t.key))
            }
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 text-left shadow-xl transition ${
              t.kind === "paga"
                ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
                : "border-brand-blue/40 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            }`}
          >
            <span className="text-2xl leading-none">
              {t.kind === "paga" ? "✅" : "🔔"}
            </span>
            <span className="flex flex-col">
              <span
                className={`font-semibold ${
                  t.kind === "paga"
                    ? "text-green-800 dark:text-green-200"
                    : "text-blue-800 dark:text-blue-200"
                }`}
              >
                {t.kind === "paga"
                  ? "Pagamento recebido!"
                  : "Nova cobrança gerada"}
              </span>
              <span className="text-sm text-zinc-700 dark:text-zinc-200">
                {brl(t.amount)}
                {t.email ? ` · ${t.email}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

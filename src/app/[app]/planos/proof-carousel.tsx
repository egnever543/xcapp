"use client";

import { useEffect, useRef, useState } from "react";

// Carrossel automático de provas sociais (prints). Avança sozinho a cada ~4s,
// pausa ao passar o mouse, e tem setas + indicadores. As imagens são exibidas
// com object-contain (mantém o print inteiro, sem cortar).
export function ProofCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = images.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (n <= 1 || paused) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % n);
    }, 4000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [n, paused]);

  if (n === 0) return null;

  const go = (i: number) => setIdx(((i % n) + n) % n);

  return (
    <section
      id="provas"
      className="mx-auto w-full max-w-3xl px-6 pt-12 pb-4 text-center"
    >
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Quem assina, aprova
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600">
        Veja o que nossos clientes falam depois de comprar.
      </p>

      <div
        className="relative mx-auto mt-8 w-full max-w-md"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="relative h-[26rem] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`Prova social ${i + 1}`}
              loading="lazy"
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                i === idx ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}

          {n > 1 && (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => go(idx - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-black shadow hover:bg-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Próximo"
                onClick={() => go(idx + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-brand-black shadow hover:bg-white"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>

        {n > 1 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                aria-label={`Ir para a prova ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === idx ? "bg-brand-blue" : "bg-zinc-300 hover:bg-zinc-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

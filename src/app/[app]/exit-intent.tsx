"use client";

import { useEffect, useRef, useState } from "react";
import { darken } from "@/lib/color";

// Popup de "não perca o lead": aparece quando o cliente tenta sair do site
// (aperta voltar, ou leva o mouse para fora no desktop) e oferece um teste
// grátis com um botão que abre o WhatsApp do app com a mensagem pronta.
// Mostra no máximo uma vez por sessão.
export function ExitIntent({
  appSlug,
  appName,
  appColor,
  whatsapp,
}: {
  appSlug: string;
  appName: string;
  appColor: string;
  whatsapp: string;
}) {
  const [open, setOpen] = useState(false);
  const triggeredRef = useRef(false);

  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const waNumber =
    digits.startsWith("55") || digits.length < 10 ? digits : `55${digits}`;
  const mensagem = `Olá! Vim do site do ${appName} e quero fazer um *teste grátis*. Pode me ajudar?`;
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(mensagem)}`
    : "";

  useEffect(() => {
    if (!waHref) return;

    // Já mostrou nesta sessão? Não repete.
    const key = `exit_offer_${appSlug}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // ignore
    }

    const dispara = () => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
      setOpen(true);
    };

    // Botão "voltar": adiciona uma entrada "armadilha" no histórico e, quando
    // o cliente aperta voltar, mostra o popup em vez de sair.
    let armed = false;
    try {
      history.pushState({ exitTrap: true }, "", location.href);
      armed = true;
    } catch {
      // ignore
    }
    const onPop = () => {
      if (triggeredRef.current) return; // já mostrou: deixa navegar
      // Re-arma para segurar o cliente e dispara o popup.
      try {
        history.pushState({ exitTrap: true }, "", location.href);
      } catch {
        // ignore
      }
      dispara();
    };

    // Desktop: mouse saindo pela parte de cima da janela (indo para as abas).
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) dispara();
    };

    window.addEventListener("popstate", onPop);
    document.addEventListener("mouseout", onMouseOut);

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("mouseout", onMouseOut);
      // Remove a entrada armadilha se ainda estiver ativa e não disparou.
      if (armed && !triggeredRef.current) {
        try {
          history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [appSlug, waHref]);

  if (!open || !waHref) return null;

  return (
    <div
      style={
        {
          "--brand-blue": appColor,
          "--brand-blue-dark": darken(appColor),
        } as React.CSSProperties
      }
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
          className="ml-auto block rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-brand-black"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="mx-auto -mt-2 mb-2 text-4xl">🎁</div>
        <h2 className="text-xl font-bold text-brand-black">
          Espera! Que tal um teste grátis?
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Antes de sair, experimente o {appName} sem pagar nada. Fale com a
          gente no WhatsApp e liberamos seu teste na hora.
        </p>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-5 py-3 font-semibold text-white transition-colors hover:bg-green-600"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M17.5 14.4c-.3-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.19.29-.74.94-.9 1.13-.17.19-.33.22-.62.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.44-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38s1.02 2.76 1.17 2.95c.15.19 2.02 3.08 4.9 4.32.68.29 1.21.47 1.63.6.68.22 1.31.19 1.8.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.06L2 22l5.06-1.33A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
          </svg>
          Quero meu teste grátis
        </a>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-600"
        >
          Não, obrigado
        </button>
      </div>
    </div>
  );
}

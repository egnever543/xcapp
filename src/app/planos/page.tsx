"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { plans } from "@/lib/plans";
import { getLead, type StoredLead } from "@/lib/lead-storage";
import { WhatsAppButton } from "../whatsapp-button";

// Screenshots do app exibidos na página de compra.
// Para adicionar mais imagens, coloque os arquivos em /public/app e
// acrescente novas entradas (src/alt/width/height) neste array.
const appScreens = [
  {
    src: "/app/xtream-login.png",
    alt: "Tela de login Xtream Codes do app xciptv",
    width: 1332,
    height: 746,
  },
];

// Número de WhatsApp para compra (só dígitos, com DDI). Configurável por env var.
const whatsappNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
  /\D/g,
  "",
);
const whatsappHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      "Olá! Quero comprar o xciptv.",
    )}`
  : null;
// Link de suporte (usado na tela de compra confirmada).
const whatsappSupportHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      "Olá! Comprei o xciptv mas não recebi os dados de acesso por e-mail.",
    )}`
  : null;

export default function PlanosPage() {
  const router = useRouter();
  const [lead, setLead] = useState<StoredLead | null>(null);
  const [loading, setLoading] = useState(true);

  // Lê o lead do localStorage. Sem dados válidos (ou expirados), volta para
  // a tela inicial para preencher o formulário.
  useEffect(() => {
    const stored = getLead();
    if (!stored) {
      router.replace("/");
      return;
    }
    setLead(stored);
    setLoading(false);
  }, [router]);

  if (loading || !lead) return null;

  // Conta paga (não é trial): mostra tela de compra confirmada, sem os planos.
  if (lead.isTrial === false) {
    return (
      <div className="flex flex-1 flex-col bg-white text-brand-black">
        {/* Cabeçalho */}
        <header className="border-b border-zinc-200 bg-brand-black text-white">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <span className="text-lg font-semibold tracking-tight">
              xc<span className="text-brand-blue">iptv</span>
            </span>
            <span className="text-sm text-zinc-300">{lead.email}</span>
          </div>
        </header>

        {/* Compra confirmada */}
        <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-8 w-8 fill-none stroke-green-600"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Compra bem-sucedida!
          </h1>
          <p className="mt-3 text-zinc-600">
            Enviamos os dados de acesso para o seu e-mail
            {lead.email ? (
              <>
                {" "}
                (<span className="font-medium text-brand-black">{lead.email}</span>)
              </>
            ) : null}
            . Verifique também a caixa de spam.
          </p>
          <p className="mt-2 text-zinc-600">
            Não recebeu? Entre em contato pelo WhatsApp abaixo.
          </p>

          {whatsappSupportHref && (
            <div className="mt-8">
              <WhatsAppButton href={whatsappSupportHref}>
                Falar no WhatsApp
              </WhatsAppButton>
            </div>
          )}
        </section>

        {/* Rodapé */}
        <footer className="mt-auto border-t border-zinc-200 py-8">
          <div className="mx-auto w-full max-w-6xl px-6 text-center text-sm text-zinc-500">
            © {new Date().getFullYear()} xciptv. Todos os direitos reservados.
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white text-brand-black">
      {/* Cabeçalho */}
      <header className="border-b border-zinc-200 bg-brand-black text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">xc<span className="text-brand-blue">iptv</span></span>
          <span className="text-sm text-zinc-300">{lead.email}</span>
        </div>
      </header>

      {/* Imagens do app — para o cliente confirmar que é o app certo */}
      <section
        id="app"
        className="mx-auto w-full max-w-6xl px-6 pt-16 pb-4 text-center"
      >
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Conheça o app <span className="text-brand-blue">xciptv</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600">
          Confira o app antes de comprar e garanta que é exatamente o que você
          procura.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {appScreens.map((screen) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={screen.src}
              src={screen.src}
              alt={screen.alt}
              width={screen.width}
              height={screen.height}
              loading="lazy"
              className="h-auto w-full max-w-2xl rounded-2xl border border-zinc-200 shadow-md"
            />
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Escolha sua licença
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600">
          Após a compra, enviaremos os dados de acesso por e-mail.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-brand-blue shadow-lg"
                  : "border-zinc-200"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 w-fit rounded-full bg-brand-blue px-3 py-1 text-xs font-medium text-white">
                  Mais popular
                </span>
              )}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-zinc-600">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">R$ {plan.price}</span>
                <span className="text-zinc-500">{plan.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="text-brand-blue">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {lead.payUrl ? (
                <a
                  href={lead.payUrl}
                  className={`mt-8 block rounded-full px-5 py-3 text-center font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                      : "border border-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  Comprar {plan.name}
                </a>
              ) : (
                <button
                  disabled
                  className={`mt-8 rounded-full px-5 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.highlighted
                      ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                      : "border border-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  Comprar {plan.name}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Compra pelo WhatsApp */}
        {whatsappHref && (
          <div className="mt-12 flex justify-center">
            <WhatsAppButton href={whatsappHref}>
              Comprar pelo WhatsApp
            </WhatsAppButton>
          </div>
        )}
      </section>

      {/* Rodapé */}
      <footer className="mt-auto border-t border-zinc-200 py-8">
        <div className="mx-auto w-full max-w-6xl px-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} xciptv. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

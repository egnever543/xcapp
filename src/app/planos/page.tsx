"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { plans } from "@/lib/plans";
import { getLead, type StoredLead } from "@/lib/lead-storage";

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
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#1ebe5d]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-current"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.548 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Comprar pelo WhatsApp
            </a>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { plans } from "@/lib/plans";
import { getLead, saveLead, type StoredLead } from "@/lib/lead-storage";
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

type Vencimento = {
  expDate: number | null; // timestamp Unix em segundos
  status: string | null;
};

// Texto de dias restantes a partir do timestamp de expiração (segundos).
function diasRestantes(expDate: number): string {
  const dias = Math.ceil((expDate * 1000 - Date.now()) / 86400000);
  if (dias < 0) return "expirada";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "1 dia restante";
  return `${dias} dias restantes`;
}

export default function PlanosPage() {
  const router = useRouter();
  const [lead, setLead] = useState<StoredLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [venc, setVenc] = useState<Vencimento | null>(null);
  // Status "ao vivo" consultado no Xtream (null = ainda não consultado).
  const [liveIsTrial, setLiveIsTrial] = useState<boolean | null>(null);
  // Modal de pagamento embutido (iframe) aberto?
  const [payOpen, setPayOpen] = useState(false);

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

  // Consulta o status/vencimento no Xtream (via rota do servidor) usando as
  // credenciais salvas. Faz polling a cada 15s enquanto ainda for trial, para
  // trocar a tela automaticamente quando o pagamento for confirmado.
  useEffect(() => {
    if (!lead?.username || !lead?.password) return;
    let ativo = true;

    // Estado anterior de trial e se o e-mail de acesso já foi enviado —
    // usados para disparar o e-mail só na transição trial -> pago, uma vez.
    let prevTrial: boolean | null = lead.isTrial ?? null;
    let notified = lead.notified ?? false;

    // Envia o e-mail com os dados de acesso (uma única vez).
    const enviarEmailAcesso = () => {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: lead.email,
          username: lead.username,
          password: lead.password,
        }),
      }).catch(() => {
        // Silencioso: se falhar, não trava a tela.
      });
    };

    const check = async (): Promise<boolean | null> => {
      try {
        const r = await fetch("/api/xtream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            username: lead.username,
            password: lead.password,
          }),
        });
        const d = await r.json();
        if (!ativo || d?.error) return null;

        setVenc({
          expDate: d.expDate != null ? Number(d.expDate) : null,
          status: d.status ?? null,
        });

        if (typeof d.isTrial === "boolean") {
          setLiveIsTrial(d.isTrial);

          // Transição trial -> pago: dispara o e-mail com os dados de acesso.
          const virouPago = prevTrial === true && d.isTrial === false;
          if (virouPago && !notified) {
            notified = true;
            enviarEmailAcesso();
          }
          prevTrial = d.isTrial;

          // Persiste status/flag de e-mail no localStorage.
          if (d.isTrial !== lead.isTrial || notified !== lead.notified) {
            saveLead({ ...lead, isTrial: d.isTrial, notified });
          }
          return d.isTrial;
        }
        return null;
      } catch {
        return null;
      }
    };

    // Consulta imediata ao carregar / dar F5 na página.
    check();

    // Polling a cada 15s enquanto ainda for trial.
    const id = setInterval(async () => {
      const t = await check();
      // Já virou pago (não-trial): pode parar de consultar.
      if (t === false) clearInterval(id);
    }, 15000);

    // Força uma atualização sempre que a aba volta ao foco / fica visível
    // (ex.: cliente sai para pagar e retorna à página).
    const onFocus = () => {
      check();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ativo = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [lead]);

  if (loading || !lead) return null;

  // Status efetivo: prioriza o consultado ao vivo no Xtream; se ainda não
  // consultou, usa o que veio do chatbot/localStorage.
  const isTrialEffective = liveIsTrial ?? lead.isTrial;

  // Conta paga (não é trial): mostra tela de compra confirmada, sem os planos.
  if (isTrialEffective === false) {
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

          {venc && (venc.expDate || venc.status) && (
            <div className="mt-6 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              {venc.status && (
                <p className="text-zinc-600">
                  Status:{" "}
                  <span className="font-medium text-brand-black">
                    {venc.status}
                  </span>
                </p>
              )}
              <p className="text-zinc-600">
                {venc.expDate ? (
                  <>
                    Sua licença vence em{" "}
                    <span className="font-medium text-brand-black">
                      {new Date(venc.expDate * 1000).toLocaleDateString("pt-BR")}
                    </span>{" "}
                    ({diasRestantes(venc.expDate)}).
                  </>
                ) : (
                  "Sua licença não tem data de expiração."
                )}
              </p>
            </div>
          )}

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
                <button
                  type="button"
                  onClick={() => setPayOpen(true)}
                  className={`mt-8 block w-full rounded-full px-5 py-3 text-center font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                      : "border border-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  Comprar {plan.name}
                </button>
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

      {/* Modal de pagamento embutido (iframe) */}
      {payOpen && lead.payUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70">
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-2xl sm:overflow-hidden">
            {/* Barra do modal */}
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                Aguardando confirmação do pagamento… esta janela fecha sozinha.
              </div>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                aria-label="Fechar"
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-brand-black"
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
            </div>

            {/* Pagamento */}
            <iframe
              src={lead.payUrl}
              title="Pagamento"
              className="w-full flex-1 border-0"
              allow="payment *"
            />

            {/* Fallback: caso o provedor bloqueie iframe */}
            <div className="border-t border-zinc-200 px-4 py-3 text-center text-xs text-zinc-500">
              Não carregou o pagamento?{" "}
              <a
                href={lead.payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-blue hover:underline"
              >
                Abrir em nova aba
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <footer className="mt-auto border-t border-zinc-200 py-8">
        <div className="mx-auto w-full max-w-6xl px-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} xciptv. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

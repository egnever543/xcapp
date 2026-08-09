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

type PixData = {
  id: number;
  amount: number;
  qrCode: string | null; // URL da imagem do QR
  qrCodeText: string | null; // copia-e-cola
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
  // Modal de pagamento PIX (FastDePix).
  const [payOpen, setPayOpen] = useState(false);
  const [pix, setPix] = useState<PixData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixPaid, setPixPaid] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Polling do status da cobrança PIX até confirmar o pagamento.
  useEffect(() => {
    if (!pix?.id || pixPaid) return;
    let ativo = true;
    let provisionando = false;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/pix?id=${pix.id}`, { cache: "no-store" });
        const d = await r.json();
        if (!ativo || provisionando) return;

        if (d?.status === "paid" || d?.status === "approved") {
          provisionando = true;
          clearInterval(id);

          // Provisiona o acesso (cria a conta no painel + envia e-mail).
          try {
            const pr = await fetch("/api/provision", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transactionId: pix.id,
                email: lead?.email,
                phone: lead?.phone,
              }),
            });
            const pd = await pr.json();
            if (pr.ok && pd?.username && lead) {
              const atualizado = {
                ...lead,
                isTrial: false,
                notified: true,
                username: pd.username,
                password: pd.password,
              };
              saveLead(atualizado);
              if (ativo) setLead(atualizado);
            }
          } catch {
            // Se o provisionamento falhar, ainda mostramos a tela de sucesso;
            // o e-mail/painel podem ser reprocessados pelo webhook depois.
          }

          if (ativo) setPixPaid(true);
        }
      } catch {
        // silencioso
      }
    }, 4000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [pix, pixPaid, lead]);

  // Gera a cobrança PIX (FastDePix) para o plano escolhido e abre o modal.
  const iniciarPagamento = async (planId: string) => {
    setPayOpen(true);
    setPix(null);
    setPixError(null);
    setPixPaid(false);
    setCopied(false);
    setPixLoading(true);
    try {
      const r = await fetch("/api/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, phone: lead?.phone }),
      });
      const d = await r.json();
      if (!r.ok || d?.error) {
        setPixError(d?.error ?? "Falha ao gerar o PIX. Tente novamente.");
      } else {
        setPix({
          id: d.id,
          amount: d.amount,
          qrCode: d.qrCode ?? null,
          qrCodeText: d.qrCodeText ?? null,
        });
      }
    } catch {
      setPixError("Falha ao gerar o PIX. Tente novamente.");
    } finally {
      setPixLoading(false);
    }
  };

  if (loading || !lead) return null;

  // Status efetivo: prioriza o consultado ao vivo no Xtream; se ainda não
  // consultou, usa o que veio do chatbot/localStorage.
  const isTrialEffective = liveIsTrial ?? lead.isTrial;

  // Conta paga (não-trial) OU pagamento PIX confirmado: tela de compra
  // confirmada, sem os planos.
  if (isTrialEffective === false || pixPaid) {
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

          {lead.username && lead.password && (
            <div className="mt-6 w-full rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 text-left text-sm">
              <p className="mb-2 font-semibold text-brand-black">
                Seus dados de acesso
              </p>
              <p className="text-zinc-700">
                Usuário:{" "}
                <span className="font-medium text-brand-black">
                  {lead.username}
                </span>
              </p>
              <p className="text-zinc-700">
                Senha:{" "}
                <span className="font-medium text-brand-black">
                  {lead.password}
                </span>
              </p>
            </div>
          )}

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
              <button
                type="button"
                onClick={() => iniciarPagamento(plan.id)}
                className={`mt-8 block w-full rounded-full px-5 py-3 text-center font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                    : "border border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                Comprar {plan.name}
              </button>
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
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
            {/* Barra do modal */}
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <span className="font-semibold text-brand-black">
                Pagamento via PIX
              </span>
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

            <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
              {pixLoading && (
                <p className="py-8 text-sm text-zinc-600">Gerando cobrança…</p>
              )}

              {pixError && (
                <div className="py-4">
                  <p className="text-sm font-medium text-red-600">{pixError}</p>
                </div>
              )}

              {pix && !pixError && (
                <>
                  <p className="text-sm text-zinc-600">
                    Escaneie o QR Code ou copie o código para pagar
                    {typeof pix.amount === "number" && (
                      <>
                        {" "}
                        <span className="font-semibold text-brand-black">
                          R$ {pix.amount.toFixed(2).replace(".", ",")}
                        </span>
                      </>
                    )}
                    .
                  </p>

                  {pix.qrCode && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pix.qrCode}
                      alt="QR Code PIX"
                      className="h-56 w-56 rounded-lg border border-zinc-200"
                    />
                  )}

                  {pix.qrCodeText && (
                    <div className="w-full">
                      <div className="max-h-24 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left text-xs break-all text-zinc-700">
                        {pix.qrCodeText}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (pix.qrCodeText) {
                            navigator.clipboard
                              ?.writeText(pix.qrCodeText)
                              .then(() => setCopied(true))
                              .catch(() => {});
                          }
                        }}
                        className="mt-3 w-full rounded-full bg-brand-blue px-5 py-3 font-medium text-white transition-colors hover:bg-brand-blue-dark"
                      >
                        {copied ? "Código copiado!" : "Copiar código PIX"}
                      </button>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-blue" />
                    Aguardando confirmação do pagamento… esta janela fecha
                    sozinha.
                  </div>
                </>
              )}
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

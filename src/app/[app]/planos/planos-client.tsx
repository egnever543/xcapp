"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listPackages,
  formatPrice,
  type Package,
} from "@/lib/packages";
import { getLead, saveLead, type StoredLead } from "@/lib/lead-storage";
import { darken } from "@/lib/color";
import type { AppConfig } from "@/lib/db";
import { WhatsAppButton } from "../../whatsapp-button";

// Perguntas frequentes exibidas na página de compra.
const faq: { q: string; a: string }[] = [
  {
    q: "Como recebo meu acesso depois do pagamento?",
    a: "Assim que o PIX é confirmado, enviamos usuário, senha e a URL do servidor por e-mail — e também mostramos na tela.",
  },
  {
    q: "Em quanto tempo é liberado?",
    a: "Na hora. A ativação é automática logo após a confirmação do pagamento.",
  },
  {
    q: "Funciona em quais aparelhos?",
    a: "Smart TV, TV Box, celular (Android e iOS), computador e apps compatíveis com Xtream Codes.",
  },
  {
    q: "Quantas telas posso usar ao mesmo tempo?",
    a: "Depende do plano escolhido: 1 ou 2 telas simultâneas.",
  },
  {
    q: "Preciso de qual velocidade de internet?",
    a: "Recomendamos a partir de ~15 Mbps para HD e ~25 Mbps para 4K.",
  },
  {
    q: "Como faço o pagamento?",
    a: "Por PIX, direto no site — rápido e seguro. O acesso é liberado automaticamente após a confirmação.",
  },
  {
    q: "E se eu me arrepender da compra?",
    a: "Você tem garantia de reembolso em até 7 dias. Se não gostar, devolvemos o valor pago.",
  },
  {
    q: "Não recebi o e-mail, e agora?",
    a: "Confira a caixa de spam. Se ainda assim não encontrar, fale com a gente no WhatsApp que reenviamos os dados na hora.",
  },
  {
    q: "Tem fidelidade ou contrato?",
    a: "Não. Você paga apenas pelo período escolhido e renova quando quiser.",
  },
  {
    q: "Como faço para renovar?",
    a: "É só voltar ao site e comprar novamente o período desejado.",
  },
];

type Vencimento = {
  expDate: number | null; // timestamp Unix em segundos
  status: string | null;
};

type PixData = {
  id: number;
  amount: number;
  qrCode: string | null; // URL da imagem do QR
  qrCodeText: string | null; // copia-e-cola
  packageId: string; // pacote escolhido (para o provisionamento)
};

// Texto de dias restantes a partir do timestamp de expiração (segundos).
function diasRestantes(expDate: number): string {
  const dias = Math.ceil((expDate * 1000 - Date.now()) / 86400000);
  if (dias < 0) return "expirada";
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "1 dia restante";
  return `${dias} dias restantes`;
}

export function PlanosClient({ app }: { app: AppConfig }) {
  const router = useRouter();
  // Contatos de WhatsApp derivados da config do app (venda e suporte usam o
  // mesmo número; vazio quando o app não define um número).
  const whatsappNumber = (app.whatsapp ?? "").replace(/\D/g, "");
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}`
    : "";
  const whatsappSupportHref = whatsappHref;
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
  // Seleção: nº de telas e conteúdo adulto (define quais pacotes exibir).
  const [telas, setTelas] = useState<1 | 2>(1);
  const [adult, setAdult] = useState(false);
  // Config de marketing (Google Ads) e trava de disparo único da conversão.
  const [config, setConfig] = useState<{
    googleAdsId: string;
    conversionLabel: string;
  } | null>(null);
  const conversionFired = useRef(false);

  // Lê o lead do localStorage. Sem dados válidos (ou expirados), volta para
  // a tela inicial para preencher o formulário.
  useEffect(() => {
    const stored = getLead(app.slug);
    if (!stored) {
      router.replace(`/${app.slug}`);
      return;
    }
    setLead(stored);
    setLoading(false);
  }, [router, app.slug]);

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
          app: app.slug,
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
            saveLead(app.slug, { ...lead, isTrial: d.isTrial, notified });
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
  }, [lead, app.slug]);

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
                app: app.slug,
                transactionId: pix.id,
                packageId: pix.packageId,
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
              saveLead(app.slug, atualizado);
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
  }, [pix, pixPaid, lead, app.slug]);

  // Carrega a config de marketing (Google Ads) uma vez.
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) =>
        setConfig({
          googleAdsId: d?.googleAdsId ?? "",
          conversionLabel: d?.conversionLabel ?? "",
        }),
      )
      .catch(() => {});
  }, []);

  // Ao confirmar o pagamento, dispara o evento de conversão do Google Ads.
  useEffect(() => {
    if (!pixPaid || !pix || conversionFired.current) return;
    if (!config?.googleAdsId || !config.conversionLabel) return;
    const gtag = (
      window as unknown as { gtag?: (...args: unknown[]) => void }
    ).gtag;
    if (typeof gtag !== "function") return;
    conversionFired.current = true;
    gtag("event", "conversion", {
      send_to: `${config.googleAdsId}/${config.conversionLabel}`,
      value: pix.amount,
      currency: "BRL",
      transaction_id: String(pix.id),
    });
  }, [pixPaid, pix, config]);

  // Gera a cobrança PIX (FastDePix) para o pacote escolhido e abre o modal.
  const iniciarPagamento = async (pkg: Package) => {
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
        body: JSON.stringify({
          app: app.slug,
          packageId: pkg.id,
          phone: lead?.phone,
          email: lead?.email,
        }),
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
          packageId: pkg.id,
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
      <div
        style={
          {
            "--brand-blue": app.color,
            "--brand-blue-dark": darken(app.color),
          } as React.CSSProperties
        }
        className="flex flex-1 flex-col bg-white text-brand-black"
      >
        {/* Cabeçalho */}
        <header className="border-b border-zinc-200 bg-brand-black text-white">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {app.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.logoUrl}
                  alt={`Logo ${app.name}`}
                  className="h-7 w-7 rounded-md object-contain"
                />
              )}
              {app.name}
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
            © {new Date().getFullYear()} {app.name}. Todos os direitos
            reservados.
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div
      style={
        {
          "--brand-blue": app.color,
          "--brand-blue-dark": darken(app.color),
        } as React.CSSProperties
      }
      className="flex flex-1 flex-col bg-white text-brand-black"
    >
      {/* Cabeçalho */}
      <header className="border-b border-zinc-200 bg-brand-black text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {app.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={app.logoUrl}
                alt={`Logo ${app.name}`}
                className="h-7 w-7 rounded-md object-contain"
              />
            )}
            {app.name}
          </span>
          <span className="text-sm text-zinc-300">{lead.email}</span>
        </div>
      </header>

      {/* Vídeo do app — para o cliente confirmar que é o app certo */}
      {app.videoId && (
      <section
        id="app"
        className="mx-auto w-full max-w-6xl px-6 pt-16 pb-4 text-center"
      >
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Conheça o app <span className="text-brand-blue">{app.name}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600">
          Veja o app funcionando antes de comprar e garanta que é exatamente o
          que você procura.
        </p>
        <div className="mx-auto mt-10 w-full max-w-3xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-200 shadow-md">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${app.videoId}`}
              title={`Conheça o app ${app.name}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>
      )}

      {/* Planos */}
      <section id="planos" className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Escolha sua licença
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-600">
          Ativação na hora. Após a compra, enviaremos os dados de acesso por
          e-mail.
        </p>

        {/* Seletores: telas e conteúdo adulto */}
        <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-10">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Quantas telas?
            </span>
            <div className="inline-flex rounded-full border border-zinc-300 p-1">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTelas(n)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                    telas === n
                      ? "bg-brand-blue text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {n} {n === 1 ? "tela" : "telas"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Conteúdo adulto?
            </span>
            <div className="inline-flex rounded-full border border-zinc-300 p-1">
              <button
                type="button"
                onClick={() => setAdult(false)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  !adult
                    ? "bg-brand-blue text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Sem adulto
              </button>
              <button
                type="button"
                onClick={() => setAdult(true)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  adult
                    ? "bg-brand-blue text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Com adulto
              </button>
            </div>
          </div>
        </div>

        {/* Cards filtrados pela seleção */}
        {(() => {
          const lista = listPackages(telas, adult);
          const mensal = lista.find((p) => p.duration === "mensal");
          const mensalMonthly = mensal
            ? mensal.priceCents / mensal.months
            : null;
          const destacadoId = lista.length
            ? lista[lista.length - 1].id
            : null;

          return (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((pkg) => {
                const monthly = pkg.priceCents / pkg.months;
                const economia = mensalMonthly
                  ? Math.round((1 - monthly / mensalMonthly) * 100)
                  : 0;
                const highlighted = pkg.id === destacadoId;
                return (
                  <div
                    key={pkg.id}
                    className={`flex flex-col rounded-2xl border p-6 ${
                      highlighted
                        ? "border-brand-blue shadow-lg"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {pkg.durationLabel}
                      </h3>
                      {economia > 0 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Economize {economia}%
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-sm text-zinc-500">R$</span>
                      <span className="text-4xl font-bold">
                        {formatPrice(pkg.priceCents)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      equivale a R$ {formatPrice(Math.round(monthly))}/mês
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-brand-blue">✓</span>
                        {pkg.telas} {pkg.telas === 1 ? "tela" : "telas"}{" "}
                        simultâneas
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-blue">✓</span>
                        {pkg.adult ? "Com" : "Sem"} conteúdo adulto
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-blue">✓</span>
                        Ativação imediata
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-brand-blue">✓</span>
                        Suporte no WhatsApp
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => iniciarPagamento(pkg)}
                      className={`mt-6 block w-full rounded-full px-5 py-3 text-center font-medium transition-colors ${
                        highlighted
                          ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                          : "border border-zinc-300 hover:bg-zinc-100"
                      }`}
                    >
                      Assinar {pkg.durationLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })()}

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

      {/* Perguntas frequentes */}
      <section
        id="faq"
        className="mx-auto w-full max-w-3xl px-6 pb-16 pt-4"
      >
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-3">
          {faq.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-zinc-200 p-5 [&_svg]:open:rotate-180"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-brand-black">
                {item.q}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 fill-none stroke-brand-blue transition-transform"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-zinc-600">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          {whatsappSupportHref && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-zinc-600">Ainda com dúvidas?</p>
              <WhatsAppButton href={whatsappSupportHref}>
                Falar no WhatsApp
              </WhatsAppButton>
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("planos")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-full bg-brand-blue px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-blue-dark"
          >
            Escolher um plano
          </button>
        </div>

        {/* SEO: dados estruturados FAQPage */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }),
          }}
        />
      </section>

      {/* Rodapé */}
      <footer className="mt-auto border-t border-zinc-200 py-8">
        <div className="mx-auto w-full max-w-6xl px-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} {app.name}. Todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
}

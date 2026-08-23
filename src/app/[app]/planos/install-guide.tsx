import type { AppConfig } from "@/lib/db";

// Passo a passo de instalação por aparelho. As lojas variam, mas o fluxo é
// sempre: abrir a loja → buscar pelo nome do app → instalar → entrar com o
// usuário e a senha recebidos. Usa nome e logo do app para reconhecimento.
type Device = { nome: string; passos: string[] };

function devices(appName: string): Device[] {
  const login = "Abra o app e entre com o usuário e a senha enviados no seu e-mail.";
  return [
    {
      nome: "Smart TV LG (webOS)",
      passos: [
        "Na tela inicial da TV, abra a LG Content Store.",
        `Toque na busca (lupa) e procure por “${appName}”.`,
        "Selecione o app com o ícone acima e clique em Instalar.",
        login,
      ],
    },
    {
      nome: "Smart TV Samsung (Tizen)",
      passos: [
        "Na tela inicial, abra a Samsung Apps (menu Apps).",
        `Use a lupa e busque por “${appName}”.`,
        "Instale o app com o ícone acima.",
        login,
      ],
    },
    {
      nome: "TV Box / Android TV",
      passos: [
        "Abra a Google Play Store.",
        `Procure por “${appName}” e toque em Instalar.`,
        "Caso não encontre na loja, instale o APK que enviamos por e-mail/WhatsApp.",
        login,
      ],
    },
    {
      nome: "Celular Android",
      passos: [
        "Abra a Google Play Store.",
        `Busque por “${appName}” e instale.`,
        login,
      ],
    },
    {
      nome: "iPhone / iPad",
      passos: [
        "Abra a App Store.",
        `Busque por “${appName}” e toque em Obter/Instalar.`,
        login,
      ],
    },
    {
      nome: "Amazon Fire TV Stick",
      passos: [
        "Na tela inicial, vá em Buscar (lupa).",
        `Digite “${appName}” e selecione o app.`,
        "Clique em Baixar/Instalar.",
        login,
      ],
    },
  ];
}

export function InstallGuide({ app }: { app: AppConfig }) {
  const lista = devices(app.name);
  return (
    <section
      id="instalar"
      className="mx-auto w-full max-w-3xl px-6 pb-16 pt-4"
    >
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        {app.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.logoUrl}
            alt={`Logo ${app.name}`}
            className="h-16 w-16 rounded-2xl object-contain shadow-sm"
          />
        )}
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Como instalar o {app.name}
        </h2>
        <p className="max-w-xl text-sm text-zinc-600">
          Procure pelo app <span className="font-semibold text-brand-black">{app.name}</span> na
          loja do seu aparelho — o ícone é o mesmo mostrado acima — e entre com
          o usuário e a senha enviados no seu e-mail.
        </p>
      </div>

      <div className="space-y-3">
        {lista.map((d) => (
          <details
            key={d.nome}
            className="group rounded-2xl border border-zinc-200 p-5 [&_svg]:open:rotate-180"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-brand-black">
              <span className="flex items-center gap-3">
                {app.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={app.logoUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-8 w-8 rounded-lg object-contain"
                  />
                )}
                {d.nome}
              </span>
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
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-600 marker:text-brand-blue marker:font-semibold">
              {d.passos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}

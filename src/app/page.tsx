import Link from "next/link";
import { listApps, hasDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Página inicial: vitrine com os apps ativos. Cada card leva para /{slug}.
export default async function Home() {
  const apps = hasDb() ? await listApps(true) : [];

  return (
    <div className="flex flex-1 flex-col items-center bg-brand-black px-6 py-16 text-white">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Escolha seu app
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
          Selecione o aplicativo desejado para ver os planos e ativar seu
          acesso.
        </p>

        {apps.length === 0 ? (
          <p className="mt-16 text-sm text-zinc-500">
            Nenhum app disponível no momento.
          </p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Link
                key={app.slug}
                href={`/${app.slug}`}
                className="group flex flex-col items-center gap-4 rounded-2xl bg-white p-8 text-brand-black shadow-xl transition-transform hover:-translate-y-1"
              >
                {app.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={app.logoUrl}
                    alt={`Logo ${app.name}`}
                    className="h-20 w-20 rounded-2xl object-contain shadow-sm"
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-sm"
                    style={{ backgroundColor: app.color }}
                  >
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xl font-extrabold tracking-tight">
                  {app.name}
                </span>
                <span
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: app.color }}
                >
                  Ver planos
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

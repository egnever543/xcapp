import { redirect } from "next/navigation";
import { plans } from "@/lib/plans";
import { getSessionLead } from "@/lib/session";

export default async function PlanosPage() {
  const lead = await getSessionLead();

  // Sem dados na sessão, volta para a tela inicial.
  if (!lead) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 flex-col bg-white text-brand-black">
      {/* Cabeçalho */}
      <header className="border-b border-zinc-200 bg-brand-black text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">X IPTV</span>
          <span className="text-sm text-zinc-300">{lead.email}</span>
        </div>
      </header>

      {/* Planos */}
      <section id="planos" className="mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Escolha sua licença
        </h2>
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
                className={`mt-8 rounded-full px-5 py-3 font-medium transition-colors ${
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
      </section>

      {/* Rodapé */}
      <footer className="mt-auto border-t border-zinc-200 py-8">
        <div className="mx-auto w-full max-w-6xl px-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} X IPTV. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

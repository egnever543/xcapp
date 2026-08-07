import { LeadForm } from "./lead-form";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-brand-black px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex justify-center">
          <span className="text-3xl font-extrabold tracking-tight text-brand-black">
            X<span className="text-brand-red"> IPTV</span>
          </span>
        </div>

        <h1 className="mb-1 text-center text-xl font-bold text-brand-black">
          Bem-vindo
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600">
          Informe seus dados para continuar.
        </p>

        <LeadForm />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeadForm } from "./lead-form";
import { getLead } from "@/lib/lead-storage";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Se já existir lead válido salvo (até 7 dias), pula o formulário.
  useEffect(() => {
    if (getLead()) {
      router.replace("/planos");
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) return null;

  return (
    <div className="flex flex-1 items-center justify-center bg-brand-black px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo xciptv"
            width={512}
            height={512}
            className="h-20 w-20 rounded-2xl shadow-sm"
          />
          <span className="text-3xl font-extrabold tracking-tight text-brand-black">
            xc<span className="text-brand-blue">iptv</span>
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

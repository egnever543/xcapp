"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LeadForm } from "./lead-form";
import { getLead } from "@/lib/lead-storage";
import { darken } from "@/lib/color";
import type { AppConfig } from "@/lib/db";

export function HomeClient({ app }: { app: AppConfig }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Se já existir lead válido salvo (até 7 dias), pula o formulário.
  useEffect(() => {
    if (getLead(app.slug)) {
      router.replace(`/${app.slug}/planos`);
    } else {
      setChecking(false);
    }
  }, [router, app.slug]);

  if (checking) return null;

  return (
    <div
      style={
        {
          "--brand-blue": app.color,
          "--brand-blue-dark": darken(app.color),
        } as React.CSSProperties
      }
      className="flex flex-1 items-center justify-center bg-brand-black px-6 py-12"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          {app.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.logoUrl}
              alt={`Logo ${app.name}`}
              className="h-20 w-20 rounded-2xl object-contain shadow-sm"
            />
          )}
          <span className="text-3xl font-extrabold tracking-tight text-brand-black">
            {app.name}
          </span>
        </div>

        <h1 className="mb-1 text-center text-xl font-bold text-brand-black">
          Bem-vindo
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600">
          Informe seus dados para continuar.
        </p>

        <LeadForm appSlug={app.slug} />
      </div>
    </div>
  );
}

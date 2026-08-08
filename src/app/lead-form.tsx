"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitLead, type LeadFormState } from "./actions";
import { saveLead } from "@/lib/lead-storage";

const initialState: LeadFormState = {};

export function LeadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitLead, initialState);

  // Ao concluir com sucesso, salva no localStorage (validade de 7 dias) e
  // segue para os planos.
  useEffect(() => {
    if (state.success && state.email && state.phone) {
      saveLead({
        email: state.email,
        phone: state.phone,
        payUrl: state.payUrl,
      });
      router.push("/planos");
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-brand-black">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-brand-black outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-brand-black">
          Telefone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="(11) 99999-9999"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-3 text-brand-black outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-brand-blue">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-brand-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Continuar"}
      </button>
    </form>
  );
}

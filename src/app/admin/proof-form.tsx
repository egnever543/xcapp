"use client";

import { useActionState } from "react";
import { saveProof, type SettingsState } from "./actions";

const initial: SettingsState = {};

// Imagens de prova social exibidas no carrossel da página de vendas.
// Uma URL por linha; vale para todos os apps.
export function ProofForm({ images }: { images: string[] }) {
  const [state, action, saving] = useActionState(saveProof, initial);

  return (
    <form
      action={action}
      className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">Provas sociais (carrossel)</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Imagens (prints) exibidas em um carrossel automático na página de
        vendas. Uma URL por linha. Vale para todos os apps.
      </p>

      <textarea
        name="proof_images"
        defaultValue={images.join("\n")}
        rows={6}
        placeholder="https://.../1.jpeg&#10;https://.../2.jpeg"
        className="mt-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        {state.ok && (
          <span className="text-sm font-medium text-green-700">Salvo ✓</span>
        )}
        {state.error && (
          <span className="text-sm font-medium text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}

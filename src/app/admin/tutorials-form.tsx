"use client";

import { useActionState } from "react";
import { saveTutorials, type SettingsState } from "./actions";

const initial: SettingsState = {};

// Tutoriais de login enviados ao cliente (e-mail + WhatsApp): há 2 formas —
// instalação remota e instalação na própria TV.
export function TutorialsForm({
  remoteUrl,
  tvUrl,
}: {
  remoteUrl: string;
  tvUrl: string;
}) {
  const [state, action, saving] = useActionState(saveTutorials, initial);

  return (
    <form
      action={action}
      className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700"
    >
      <h2 className="text-lg font-semibold">Tutoriais de login</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
        Enviados no e-mail e no WhatsApp de acesso, para ajudar o cliente a
        entrar no app. Há duas formas: instalação remota e instalação na própria
        TV.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Instalação remota (URL do vídeo)
          </span>
          <input
            name="tutorial_remote_url"
            defaultValue={remoteUrl}
            placeholder="https://youtu.be/…"
            className="w-80 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Instalação na própria TV (URL do vídeo)
          </span>
          <input
            name="tutorial_tv_url"
            defaultValue={tvUrl}
            placeholder="https://youtu.be/…"
            className="w-80 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
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

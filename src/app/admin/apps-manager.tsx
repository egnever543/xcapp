"use client";

import { useActionState, useState, useTransition } from "react";
import { saveApp, removeApp, type AppFormState } from "./actions";
import type { AppConfig } from "@/lib/db";

const initial: AppFormState = {};

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

// Formulário de um app (criar ou editar). Sem `app` = criação.
function AppForm({
  app,
  onDone,
}: {
  app?: AppConfig;
  onDone?: () => void;
}) {
  const [state, action, saving] = useActionState(saveApp, initial);
  const editing = !!app;

  return (
    <form
      action={action}
      className="grid gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Slug (URL: /slug)
          </span>
          <input
            name="slug"
            defaultValue={app?.slug ?? ""}
            readOnly={editing}
            required
            placeholder="ex.: meuapp"
            className={`${inputClass} ${editing ? "opacity-60" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Nome</span>
          <input
            name="name"
            defaultValue={app?.name ?? ""}
            required
            placeholder="Nome do app"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">Cor principal</span>
          <input
            name="color"
            type="color"
            defaultValue={app?.color ?? "#1477e1"}
            className="h-10 w-20 rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            URL da logo
          </span>
          <input
            name="logo_url"
            defaultValue={app?.logoUrl ?? ""}
            placeholder="https://… ou /logo.png"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            ID do vídeo (YouTube)
          </span>
          <input
            name="video_id"
            defaultValue={app?.videoId ?? ""}
            placeholder="ex.: 9reoiOwB6EI"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            WhatsApp (com DDI/DDD)
          </span>
          <input
            name="whatsapp"
            defaultValue={app?.whatsapp ?? ""}
            placeholder="ex.: 5511999999999"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            URL/Servidor de acesso (e-mail)
          </span>
          <input
            name="access_url"
            defaultValue={app?.accessUrl ?? ""}
            placeholder="http://servidor:porta"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            URL do tutorial (vídeo no e-mail)
          </span>
          <input
            name="tutorial_url"
            defaultValue={app?.tutorialUrl ?? ""}
            placeholder="https://youtu.be/…"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            Conta Google Ads (customer id)
          </span>
          <input
            name="google_ads_customer_id"
            defaultValue={app?.googleAdsCustomerId ?? ""}
            placeholder="ex.: 1234567890"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">
          Texto de introdução do e-mail
        </span>
        <textarea
          name="email_intro"
          defaultValue={app?.emailIntro ?? ""}
          rows={2}
          placeholder="Sua compra foi confirmada! Use os dados abaixo para acessar no app:"
          className={inputClass}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="active"
          type="checkbox"
          defaultChecked={app?.active ?? true}
          className="h-4 w-4"
        />
        <span className="text-zinc-600 dark:text-zinc-300">
          Ativo (visível na página inicial)
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-blue px-5 py-2 font-medium text-white hover:bg-brand-blue-dark disabled:opacity-60"
        >
          {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar app"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-zinc-300 px-5 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
        )}
        {state.ok && (
          <span className="text-sm font-medium text-green-700">Salvo ✓</span>
        )}
        {state.error && (
          <span className="text-sm font-medium text-red-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

// Linha de um app na lista, com editar/remover embutidos.
function AppRow({ app }: { app: AppConfig }) {
  const [editing, setEditing] = useState(false);
  const [removing, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRemove = () => {
    if (
      !confirm(
        `Remover o app "${app.name}" (/${app.slug})? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    startRemove(async () => {
      const r = await removeApp(app.slug);
      if (!r.ok) setError(r.error ?? "Falha ao remover.");
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-3">
        {app.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.logoUrl}
            alt={`Logo ${app.name}`}
            className="h-10 w-10 rounded-lg object-contain"
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: app.color }}
          >
            {app.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="font-semibold">{app.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            /{app.slug}
            {!app.active && " · inativo"}
          </p>
        </div>
        <a
          href={`/${app.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Abrir
        </a>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {editing ? "Fechar" : "Editar"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
        >
          {removing ? "Removendo…" : "Remover"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
      )}
      {editing && (
        <div className="mt-4">
          <AppForm app={app} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// Painel de gestão dos apps (multi-tenant).
export function AppsManager({ apps }: { apps: AppConfig[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Apps</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Cada app tem sua própria página em <code>/slug</code>, com logo,
            cor, nome, vídeo e e-mail próprios. Pagamento e provisionamento são
            compartilhados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          {creating ? "Fechar" : "Novo app"}
        </button>
      </div>

      {creating && (
        <div className="mt-4">
          <AppForm onDone={() => setCreating(false)} />
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {apps.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum app cadastrado.
          </p>
        ) : (
          apps.map((app) => <AppRow key={app.slug} app={app} />)
        )}
      </div>
    </section>
  );
}

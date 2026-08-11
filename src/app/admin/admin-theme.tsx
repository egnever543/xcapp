"use client";

import { useEffect, useState } from "react";

// Envolve o painel admin com o tema (claro/escuro), persistido no navegador.
export function AdminTheme({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
    setReady(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("admin_theme", next);
    } catch {
      // ignora
    }
  };

  return (
    <div
      data-theme={ready ? theme : "light"}
      className="flex flex-1 flex-col bg-white text-brand-black dark:bg-zinc-900 dark:text-zinc-100"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Alternar tema"
        className="fixed right-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        {theme === "dark" ? (
          // Sol
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          // Lua
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
      {children}
    </div>
  );
}

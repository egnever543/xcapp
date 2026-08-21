// Utilitários de cor para a marca por app.

// Escurece uma cor hex (#rrggbb) por um fator (0..1). Usado no hover.
export function darken(hex: string, amount = 0.2): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Valida um hex #rrggbb; devolve fallback se inválido.
export function normalizeHex(hex: string, fallback = "#1477e1"): string {
  return /^#?[0-9a-f]{6}$/i.test((hex ?? "").trim())
    ? (hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`)
    : fallback;
}

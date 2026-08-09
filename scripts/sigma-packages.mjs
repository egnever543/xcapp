// Lista os pacotes (packages) do painel Sigma para você pegar os IDs.
//
// Uso (na SUA máquina, onde a rede não é bloqueada):
//   SIGMA_API_TOKEN=seu_token node scripts/sigma-packages.mjs
//
// Opcional: sobrescrever a base URL com SIGMA_BASE_URL.

const BASE_URL =
  process.env.SIGMA_BASE_URL ??
  "https://sistema.ftspanel.vip/api/integration/v1";
const TOKEN = process.env.SIGMA_API_TOKEN;

if (!TOKEN) {
  console.error("Defina SIGMA_API_TOKEN. Ex.: SIGMA_API_TOKEN=xxx node scripts/sigma-packages.mjs");
  process.exit(1);
}

const res = await fetch(`${BASE_URL}/packages?per_page=20`, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
  },
});

console.log("HTTP", res.status);
const text = await res.text();
try {
  console.dir(JSON.parse(text), { depth: null });
} catch {
  console.log(text);
}

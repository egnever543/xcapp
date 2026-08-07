// Script de teste do endpoint do chatbot.
//
// Faz um POST para a API e imprime a resposta CRUA, para descobrirmos
// qual é o formato (e onde vem a "Pay URL").
//
// Uso (na SUA máquina, onde a rede não é bloqueada):
//   node scripts/test-chatbot.mjs
//   node scripts/test-chatbot.mjs teste@email.com 11999999999
//
// Opcional: sobrescrever a URL do endpoint com a variável de ambiente
//   CHATBOT_URL=... node scripts/test-chatbot.mjs

const url =
  process.env.CHATBOT_URL ||
  "https://sistema.ftspanel.vip/api/chatbot/nVrW8roLKa/RYAWRk1jlx";

const email = process.argv[2] || "teste@example.com";
const phone = process.argv[3] || "11999999999";

const payload = { email, phone };

console.log("POST", url);
console.log("Body:", JSON.stringify(payload));
console.log("----------------------------------------");

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();

  console.log("HTTP status:", res.status, res.statusText);
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("----- RESPONSE (raw) -----");
  console.log(raw);
  console.log("--------------------------");

  // Tenta interpretar como JSON só para facilitar a leitura.
  try {
    const json = JSON.parse(raw);
    console.log("Parsed as JSON:");
    console.dir(json, { depth: null });
  } catch {
    console.log("(Resposta não é JSON — provavelmente texto puro / URL)");
  }
} catch (err) {
  console.error("Falha na requisição:", err);
  process.exit(1);
}

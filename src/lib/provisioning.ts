import crypto from "crypto";
import { getPackage, priceReais } from "@/lib/packages";
import { getTransaction } from "@/lib/fastdepix";
import { createCustomer } from "@/lib/sigma";
import { sendAccessEmail } from "@/lib/email";
import { sendAccessWhatsapp } from "@/lib/botbot";
import { sendOutboundEvent } from "@/lib/webhook";
import {
  getPurchase,
  getApp,
  claimProvision,
  releaseProvision,
  saveCredentials,
  markPaid,
  setProvisionError,
} from "@/lib/db";

function genUsername(): string {
  return "xc" + crypto.randomBytes(4).toString("hex");
}
function genPassword(): string {
  return crypto.randomBytes(5).toString("hex");
}

export type ProvisionResult =
  | { ok: true; username: string; password: string }
  | { ok: false; status: number; error: string };

// Provisiona o acesso de uma compra: confirma o pagamento na FastDePix, cria a
// conta no Sigma (uma única vez), grava as credenciais e envia o e-mail.
// Idempotente: chamável pelo cliente e pelo webhook sem duplicar contas.
export async function provisionPurchase(
  transactionId: string,
): Promise<ProvisionResult> {
  const purchase = await getPurchase(transactionId);
  if (!purchase) {
    return { ok: false, status: 404, error: "Compra não encontrada." };
  }

  // Já provisionada: devolve as credenciais salvas (idempotência).
  if (purchase.provisioned && purchase.username && purchase.password) {
    return {
      ok: true,
      username: purchase.username,
      password: purchase.password,
    };
  }

  const pkg = purchase.packageId ? getPackage(purchase.packageId) : undefined;
  if (!pkg) {
    return { ok: false, status: 400, error: "Pacote inválido." };
  }

  // Confirma o pagamento na fonte.
  let tx;
  try {
    tx = await getTransaction(transactionId);
  } catch {
    return { ok: false, status: 502, error: "Não foi possível confirmar o pagamento." };
  }
  if (tx.status !== "paid" && tx.status !== "approved") {
    return { ok: false, status: 402, error: "Pagamento ainda não confirmado." };
  }

  // Pagamento confirmado: marca como pago já (o dinheiro entrou), mesmo que a
  // criação da conta abaixo venha a falhar — assim nunca fica como "pendente".
  await markPaid(transactionId);

  if (Math.abs(Number(tx.amount) - priceReais(pkg.priceCents)) > 0.01) {
    const msg = `Valor pago (R$ ${Number(tx.amount).toFixed(2)}) não corresponde ao pacote (R$ ${priceReais(pkg.priceCents).toFixed(2)}).`;
    await setProvisionError(transactionId, msg);
    return { ok: false, status: 400, error: msg };
  }

  // Reivindica o provisionamento (só um chamador cria a conta).
  const claimed = await claimProvision(transactionId);
  if (!claimed) {
    // Outro fluxo já provisionou (ou está provisionando): devolve o que houver.
    const again = await getPurchase(transactionId);
    if (again?.username && again?.password) {
      return { ok: true, username: again.username, password: again.password };
    }
    return { ok: false, status: 409, error: "Provisionamento em andamento." };
  }

  const username = genUsername();
  const password = genPassword();

  try {
    await createCustomer({
      packageId: pkg.id,
      username,
      password,
      name: purchase.email ? purchase.email.split("@")[0] : undefined,
      email: purchase.email ?? undefined,
      whatsapp: purchase.phone ? purchase.phone.replace(/\D/g, "") : undefined,
      connections: pkg.telas,
    });
  } catch (err) {
    // Falhou: libera a trava para permitir nova tentativa e registra o erro
    // para o painel exibir (o pagamento já está marcado como pago).
    await releaseProvision(transactionId);
    const msg = (err as Error).message ?? "Falha ao criar o acesso.";
    await setProvisionError(transactionId, msg);
    return { ok: false, status: 502, error: msg };
  }

  await saveCredentials(transactionId, username, password);

  // Carrega a config do app da compra (marca/URL/cor/intro do e-mail).
  const app = purchase.app ? await getApp(purchase.app) : null;

  // Envia as credenciais por e-mail (não bloqueia se falhar).
  if (purchase.email) {
    try {
      await sendAccessEmail({
        email: purchase.email,
        username,
        password,
        appName: app?.name,
        accessUrl: app?.accessUrl || undefined,
        color: app?.color,
        intro: app?.emailIntro || undefined,
        tutorialUrl: app?.tutorialUrl || undefined,
      });
    } catch (err) {
      console.error("Erro ao enviar e-mail de acesso:", err);
    }
  }

  // Envia os dados de acesso também no WhatsApp (não bloqueia se falhar).
  if (purchase.phone) {
    try {
      await sendAccessWhatsapp({
        to: purchase.phone,
        appName: app?.name ?? "seu app",
        accessUrl: app?.accessUrl || undefined,
        username,
        password,
        tutorialUrl: app?.tutorialUrl || undefined,
      });
    } catch (err) {
      console.error("Erro ao enviar acesso por WhatsApp:", err);
    }
  }

  // Dispara o webhook de saída (venda concluída) — não bloqueia.
  await sendOutboundEvent("sale.completed", {
    transaction_id: transactionId,
    app: purchase.app,
    email: purchase.email,
    phone: purchase.phone,
    package: purchase.packageLabel,
    package_id: purchase.packageId,
    amount: purchase.amount,
    username,
  });

  return { ok: true, username, password };
}

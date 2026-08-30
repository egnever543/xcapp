import { NextResponse } from "next/server";
import crypto from "crypto";
import { buildAuthUrl, isOAuthConfigured } from "@/lib/google-ads";
import { setSetting } from "@/lib/db";

// Inicia o fluxo "Entrar com Google" para conectar o Google Ads.
// Protegido pelo Basic Auth do /admin via proxy (ver proxy.ts).
export async function GET(request: Request) {
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "OAuth do Google não configurado (defina GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN).",
      },
      { status: 500 },
    );
  }
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/api/google-ads/callback`;

  // state (CSRF) guardado no banco para conferência no callback.
  const state = crypto.randomBytes(16).toString("hex");
  await setSetting("google_ads_oauth_state", state);

  return NextResponse.redirect(buildAuthUrl(redirectUri, state));
}

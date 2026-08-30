import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google-ads";
import { getSettings } from "@/lib/db";

// Retorno do consentimento do Google. O Google chama esta URL (sem Basic Auth),
// por isso conferimos o `state` gerado no /connect.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = `${url.protocol}//${url.host}`;
  const back = `${origin}/admin`;

  if (err) {
    return NextResponse.redirect(`${back}?google=error`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${back}?google=error`);
  }

  // Confere o state.
  const s = await getSettings().catch(() => ({}) as Record<string, string>);
  if (!s.google_ads_oauth_state || s.google_ads_oauth_state !== state) {
    return NextResponse.redirect(`${back}?google=state`);
  }

  try {
    await exchangeCode(code, `${origin}/api/google-ads/callback`);
    return NextResponse.redirect(`${back}?google=connected`);
  } catch {
    return NextResponse.redirect(`${back}?google=fail`);
  }
}

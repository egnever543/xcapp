import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/settings";

// Config pública para o cliente (tags de marketing — não são segredos).
export async function GET() {
  const s = await loadSettings();
  return NextResponse.json({
    googleAdsId: s.googleAdsId,
    conversionLabel: s.conversionLabel,
  });
}

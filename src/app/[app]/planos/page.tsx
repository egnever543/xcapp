import { notFound } from "next/navigation";
import { getApp, hasDb } from "@/lib/db";
import { loadSettings } from "@/lib/settings";
import { PlanosClient } from "./planos-client";

export const dynamic = "force-dynamic";

export default async function AppPlanos({
  params,
}: {
  params: Promise<{ app: string }>;
}) {
  const { app: slug } = await params;
  if (!hasDb()) notFound();
  const app = await getApp(slug);
  if (!app || !app.active) notFound();
  const settings = await loadSettings().catch(() => null);
  const tutorials = {
    remoteUrl: settings?.tutorialRemoteUrl ?? "",
    tvUrl: settings?.tutorialTvUrl ?? "",
  };
  const proofImages = settings?.proofImages ?? [];
  return (
    <PlanosClient app={app} tutorials={tutorials} proofImages={proofImages} />
  );
}

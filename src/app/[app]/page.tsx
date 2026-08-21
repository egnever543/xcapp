import { notFound } from "next/navigation";
import { getApp, hasDb } from "@/lib/db";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function AppHome({
  params,
}: {
  params: Promise<{ app: string }>;
}) {
  const { app: slug } = await params;
  if (!hasDb()) notFound();
  const app = await getApp(slug);
  if (!app || !app.active) notFound();
  return <HomeClient app={app} />;
}

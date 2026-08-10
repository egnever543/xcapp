import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protege /admin com Basic Auth (usuário/senha em variáveis de ambiente).
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  const header = request.headers.get("authorization") ?? "";
  if (user && pass && header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);
    if (u === user && p === pass) {
      return NextResponse.next();
    }
  }

  // Sem credenciais válidas (ou admin não configurado): pede autenticação.
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

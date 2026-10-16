import { NextResponse, type NextRequest } from "next/server"
import { startCanvaConnect } from "@/lib/canva-connect"
import { canvaConnectDeps } from "@/lib/owned-meta-execution"

export const runtime = "nodejs"

/** One-time Canva connection for the publisher (see lib/canva-connect.ts). Production only. */
export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Previews cannot connect Canva" }, { status: 423 })
  const deps = await canvaConnectDeps()
  if (!deps) return NextResponse.json({ error: "Canva integration is not configured" }, { status: 503 })
  const r = await startCanvaConnect(deps)
  return r.location ? NextResponse.redirect(new URL(r.location, req.nextUrl.origin), 302) : NextResponse.json({ error: r.error }, { status: r.status, headers: { "cache-control": "private, no-store" } })
}

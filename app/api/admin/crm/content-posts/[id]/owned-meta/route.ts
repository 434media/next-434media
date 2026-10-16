import { NextResponse, type NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { ownedMetaStore } from "@/lib/firestore-crm"
import { MetaBlocked } from "@/lib/owned-meta-publisher"
import { readTrustedAsset, verifyAssetBytes } from "@/lib/owned-meta-assets"
import { ownedMetaActionBody, runOwnedMetaAction, ownedMetaStatus, ownedMetaConnectionReport, deploymentEnabled, sourceOrigins, OwnedMetaActionError, type OwnedMetaActor } from "@/lib/owned-meta-actions"

export const runtime = "nodejs"
// The publisher's actions live in lib/owned-meta-actions.ts, shared with the
// content MCP route. This file only maps an admin session onto an actor.
async function authorize(): Promise<{ error: string; status: 401 | 403 } | { actor: OwnedMetaActor }> {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 }
  const superAdmin = await isCrmSuperAdmin(session.email)
  if (!isAuthorizedAdmin(session.email) || !canSend(session.role) && !superAdmin) return { error: "Publishing role required", status: 403 }
  return { actor: { email: session.email, superAdmin, founder: session.email.toLowerCase() === "marcos@434media.com" } }
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ enabled: false })
  const auth = await authorize(); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  const connection = req.nextUrl.searchParams.get("checkConnection") === "1"
  if (connection && !auth.actor.superAdmin) return NextResponse.json({ error: "Super-admin connection check required" }, { status: 403 })
  try {
    if (connection) {
      const report = await ownedMetaConnectionReport(id)
      return NextResponse.json(report, { headers: { "cache-control": "private, no-store" } })
    }
    const index = req.nextUrl.searchParams.get("asset")
    if (index !== null) {
      const r = await ownedMetaStore().read(id)
      const i = Number(index), a = r.batch.manifest.assets[i]
      if (!Number.isInteger(i) || !a || req.nextUrl.searchParams.get("hash") !== r.batch.hash) throw new MetaBlocked("Review asset changed")
      const bytes = await readTrustedAsset(a.url, sourceOrigins()); verifyAssetBytes(a, bytes)
      let offset = 0
      const stream = new ReadableStream<Uint8Array>({ pull(controller) { if (offset >= bytes.length) { controller.close(); return } controller.enqueue(bytes.subarray(offset, offset + 64 * 1024)); offset += 64 * 1024 } })
      return new Response(stream, { headers: { "content-type": a.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } })
    }
    return NextResponse.json(await ownedMetaStatus(id, auth.actor))
  } catch (error) {
    if (error instanceof OwnedMetaActionError && error.status === 409) return NextResponse.json({ error: error.message, batch: error.batch }, { status: 409, headers: { "cache-control": "private, no-store" } })
    if (connection) return NextResponse.json({ error: "Connection check unavailable; configuration or saved state could not be read" }, { status: 503, headers: { "cache-control": "private, no-store" } })
    return NextResponse.json({ enabled: await deploymentEnabled(), batch: null, error: "Review unavailable" }, { status: 404 })
  }
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Previews cannot write publisher data" }, { status: 423 })
  const auth = await authorize(); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  let body: ReturnType<typeof ownedMetaActionBody.parse>
  try { body = ownedMetaActionBody.parse(await req.json()) } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  // Founder-only recovery is refused here, before any storage or provider access, as well as in the action.
  if (body.action === "recover-facebook" && !auth.actor.founder) return NextResponse.json({ error: "Founder recovery required" }, { status: 403 })
  try {
    const batch = await runOwnedMetaAction(id, body, auth.actor)
    return NextResponse.json({ batch })
  } catch (error) {
    if (error instanceof OwnedMetaActionError) return NextResponse.json({ error: error.message, ...(error.batch ? { batch: error.batch } : {}), ...(error.providerError ? { providerError: error.providerError } : {}) }, { status: error.status })
    return NextResponse.json({ error: "Publisher failed; inspect saved state before retrying" }, { status: 500 })
  }
}

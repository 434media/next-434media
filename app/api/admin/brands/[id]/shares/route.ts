import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSendCapable } from "@/lib/auth"
import { requireStaff } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"
import { DAILY_SHARE_CAP, DEFAULT_SHARE_DAYS, MAX_SHARE_DAYS, chicagoDay, shareState } from "@/lib/brand-share"
import type { BrandShare } from "@/lib/firestore-brand-shares"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** A share as the brand page lists it: never the token's hash. */
const listed = (s: BrandShare, now: Date) => ({
  id: s.id, state: shareState(s, now), versionId: s.version_id, recipientName: s.recipient_name, recipientEmail: s.recipient_email, recipientCountry: s.recipient_country,
  senderEmail: s.sender_email, via: s.via, createdAt: s.created_at, expiresAt: s.expires_at, revokedBy: s.revoked_by, revokedAt: s.revoked_at,
  views: s.view_count, lastViewedAt: s.last_viewed_at, downloads: s.download_count, lastDownloadedAt: s.last_downloaded_at, messageId: s.resend_message_id,
})

/**
 * GET /api/admin/brands/[id]/shares — the brand's vendor shares (plan v11.2.1 Step 4 item 4), newest first, with their
 * state, views and downloads, and how many the caller has left today. 434 staff (interns excluded), as the brand book.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const { firestoreBrandShares } = await import("@/lib/firestore-brand-shares")
    const store = firestoreBrandShares(), now = new Date()
    const [shares, used] = await Promise.all([store.forBrand(id), store.usedOn(auth.session.email, chicagoDay(now))])
    return NextResponse.json({ shares: shares.map(s => listed(s, now)), left: Math.max(0, DAILY_SHARE_CAP - used), cap: DAILY_SHARE_CAP, defaultDays: DEFAULT_SHARE_DAYS, maxDays: MAX_SHARE_DAYS }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brands/[id]/shares]", err)
    return NextResponse.json({ error: "Could not read the shares" }, { status: 500 })
  }
}

const body = z.object({
  name: z.string().max(100).default(""),
  email: z.string().min(3).max(254),
  country: z.string().min(2).max(80),
  expiresDays: z.number().int().min(1).max(MAX_SHARE_DAYS).optional(),
  /** Audit only: the brand page sends "button", the send command "command". */
  via: z.enum(["button", "command"]).default("button"),
})

/**
 * POST /api/admin/brands/[id]/shares — share the brand's book with a vendor: the one send path for the button and the
 * send command (Step 4 items 4–5). 434 staff only. lib/brand-share-send.ts runs the checks (book, jurisdiction,
 * suppression, the daily cap, a repeat), records the share with the token's hash only, and mails the link through
 * Resend. A refusal says why and sends nothing. The token is never returned: it exists only in the email.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSendCapable()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Give the recipient's email and country" }, { status: 400 })
  const b = parsed.data
  try {
    const [{ sendBrandShare }, { liveShareDeps }] = await Promise.all([import("@/lib/brand-share-send"), import("@/lib/brand-share-deps")])
    const out = await sendBrandShare(
      { brandId: id, recipientName: b.name, recipientEmail: b.email, country: b.country, expiresDays: b.expiresDays, via: b.via, sender: { email: auth.session.email, name: auth.session.name } },
      liveShareDeps(req.nextUrl.origin),
    )
    console.info("[brands/shares]", JSON.stringify({ by: auth.session.email, brand: id, via: b.via, ok: out.ok, ...(out.ok ? { share: out.share.id, version: out.share.version_id, message: out.share.resend_message_id } : { code: out.code }) }))
    if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status })
    return NextResponse.json({ share: listed(out.share, new Date()) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/admin/brands/[id]/shares]", err)
    return NextResponse.json({ error: "The share could not be sent" }, { status: 500 })
  }
}

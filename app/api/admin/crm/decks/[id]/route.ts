import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDeckById, updateDeck, deleteDeck } from "@/lib/firestore-deck"
import type { DeckStatus, DeckSlide, UpdateDeckInput } from "@/types/deck-types"

export const runtime = "nodejs"

const VALID_STATUSES = new Set<DeckStatus>(["draft", "published"])

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/crm/decks/[id]
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const deck = await getDeckById(id)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    return NextResponse.json({ success: true, deck })
  } catch (err) {
    console.error(`[GET /api/admin/crm/decks/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load deck" },
      { status: 500 },
    )
  }
}

// PATCH /api/admin/crm/decks/[id] — update name/brand/status/slides (autosave).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params

  let body: UpdateDeckInput
  try {
    body = (await req.json()) as UpdateDeckInput
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: `status must be one of ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 },
    )
  }

  const updates: UpdateDeckInput = {}
  if (typeof body.name === "string") updates.name = body.name
  if (body.brand !== undefined) updates.brand = body.brand
  if (body.status !== undefined) updates.status = body.status
  if (Array.isArray(body.slides)) updates.slides = body.slides as DeckSlide[]

  try {
    const deck = await updateDeck(id, updates)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    return NextResponse.json({ success: true, deck })
  } catch (err) {
    console.error(`[PATCH /api/admin/crm/decks/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update deck" },
      { status: 500 },
    )
  }
}

// DELETE /api/admin/crm/decks/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    await deleteDeck(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[DELETE /api/admin/crm/decks/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete deck" },
      { status: 500 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createDeck, listDecks } from "@/lib/firestore-deck"
import type { CreateDeckInput, DeckSlide } from "@/types/deck-types"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/crm/decks — list decks, newest-updated first.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const decks = await listDecks()
    return NextResponse.json({ success: true, decks })
  } catch (err) {
    console.error("[GET /api/admin/crm/decks]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list decks" },
      { status: 500 },
    )
  }
}

// POST /api/admin/crm/decks — create a deck. The caller passes the seeded slides
// (the default template, produced client-side); this route just persists them.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Partial<CreateDeckInput>
  try {
    body = (await req.json()) as Partial<CreateDeckInput>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled deck"
  const slides: DeckSlide[] = Array.isArray(body.slides) ? body.slides : []

  try {
    const deck = await createDeck({
      name,
      brand: body.brand,
      slides,
      created_by: auth.session.email,
    })
    return NextResponse.json({ success: true, deck })
  } catch (err) {
    console.error("[POST /api/admin/crm/decks]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create deck" },
      { status: 500 },
    )
  }
}

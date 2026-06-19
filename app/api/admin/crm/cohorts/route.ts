import { type NextRequest, NextResponse } from "next/server"
import { requireFullAdmin, requireAdmin } from "@/lib/auth"
import {
  getCohorts,
  getCohortById,
  getCohortBySlug,
  createCohort,
  updateCohort,
  deleteCohort,
} from "@/lib/firestore-crm"
import type { Cohort } from "@/types/crm-types"

export const runtime = "nodejs"

// Operator-managed (full_admin+). Cohorts are the Digital Canvas program spine;
// interns never touch this surface.

const VALID_VERTICALS = [
  "cybersecurity",
  "fintech",
  "military",
  "health",
  "science",
  "education",
  "aerospace",
  "sales_media",
  "other",
]
const VALID_STATUSES = [
  "forming",
  "problem_set",
  "recruiting",
  "active",
  "demo_day",
  "complete",
  "cancelled",
]
const VALID_BRANDS = [
  "434 Media",
  "Vemos Vamos",
  "DEVSA",
  "Digital Canvas",
  "TXMX Boxing",
]

// URL handle from a cohort name, e.g. "434 Media" → "434-media".
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "cohort"
  )
}

// Ensure the slug is unique across cohorts (append -2, -3, … on collision).
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const all = await getCohorts({ fresh: true })
  const taken = new Set(all.filter((c) => c.id !== excludeId).map((c) => c.slug).filter(Boolean))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

// GET — list all cohorts, or a single cohort (?id=). Intern-readable so they can
// reach their cohort board; cohort mutations below stay operator-only.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const params = new URL(request.url).searchParams
    // `ref` resolves a doc id OR a slug (URL handle); `id` kept for back-compat.
    const ref = params.get("id") || params.get("ref")
    if (ref) {
      const cohort = (await getCohortById(ref)) || (await getCohortBySlug(ref))
      if (!cohort) return NextResponse.json({ success: false, error: "Cohort not found" }, { status: 404 })
      return NextResponse.json({ success: true, data: cohort })
    }
    const cohorts = await getCohorts({ fresh: true })
    return NextResponse.json({ success: true, data: cohorts })
  } catch (error) {
    console.error("Error fetching cohorts:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch cohorts" }, { status: 500 })
  }
}

// POST — create a cohort
export async function POST(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { name, vertical, hostBrand, status } = body as Partial<Cohort>

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 })
    }
    if (!vertical || !VALID_VERTICALS.includes(vertical)) {
      return NextResponse.json({ success: false, error: "Valid vertical is required" }, { status: 400 })
    }
    if (!hostBrand || !VALID_BRANDS.includes(hostBrand)) {
      return NextResponse.json({ success: false, error: "Valid host brand is required" }, { status: 400 })
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 })
    }

    const cohort = await createCohort({
      name: name.trim(),
      slug: await uniqueSlug(slugify(name)),
      vertical,
      hostBrand,
      status: status ?? "forming",
      sponsorClientId: body.sponsorClientId ?? null,
      sponsorName: body.sponsorName?.trim() || undefined,
      workshopDate: body.workshopDate || undefined,
      bridgeStart: body.bridgeStart || undefined,
      bridgeEnd: body.bridgeEnd || undefined,
      demoDayDate: body.demoDayDate || undefined,
      capacity: typeof body.capacity === "number" ? body.capacity : undefined,
      notes: body.notes?.trim() || undefined,
      created_by: auth.session.email,
    })
    return NextResponse.json({ success: true, data: cohort })
  } catch (error) {
    console.error("Error creating cohort:", error)
    return NextResponse.json({ success: false, error: "Failed to create cohort" }, { status: 500 })
  }
}

// PATCH — update a cohort (body.id + changed fields)
export async function PATCH(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ success: false, error: "Cohort id is required" }, { status: 400 })

    const updates: Partial<Cohort> = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.vertical !== undefined) {
      if (!VALID_VERTICALS.includes(body.vertical))
        return NextResponse.json({ success: false, error: `Invalid vertical: ${body.vertical}` }, { status: 400 })
      updates.vertical = body.vertical
    }
    if (body.hostBrand !== undefined) {
      if (!VALID_BRANDS.includes(body.hostBrand))
        return NextResponse.json({ success: false, error: `Invalid host brand: ${body.hostBrand}` }, { status: 400 })
      updates.hostBrand = body.hostBrand
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status))
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      updates.status = body.status
    }
    if (body.sponsorClientId !== undefined) updates.sponsorClientId = body.sponsorClientId || null
    if (body.sponsorName !== undefined) updates.sponsorName = String(body.sponsorName).trim()
    if (body.workshopDate !== undefined) updates.workshopDate = body.workshopDate || undefined
    if (body.bridgeStart !== undefined) updates.bridgeStart = body.bridgeStart || undefined
    if (body.bridgeEnd !== undefined) updates.bridgeEnd = body.bridgeEnd || undefined
    if (body.demoDayDate !== undefined) updates.demoDayDate = body.demoDayDate || undefined
    if (body.capacity !== undefined) updates.capacity = typeof body.capacity === "number" ? body.capacity : undefined
    if (body.notes !== undefined) updates.notes = String(body.notes).trim()

    const cohort = await updateCohort(id, updates)
    return NextResponse.json({ success: true, data: cohort })
  } catch (error) {
    console.error("Error updating cohort:", error)
    return NextResponse.json({ success: false, error: "Failed to update cohort" }, { status: 500 })
  }
}

// DELETE — remove a cohort (?id=)
export async function DELETE(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, error: "Cohort id is required" }, { status: 400 })
    await deleteCohort(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cohort:", error)
    return NextResponse.json({ success: false, error: "Failed to delete cohort" }, { status: 500 })
  }
}

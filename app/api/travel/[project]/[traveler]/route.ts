import { NextResponse } from "next/server"
import { getTravelAccess } from "@/lib/travel/auth"
import { getTravelItinerary } from "@/lib/travel/airtable"
import { getTravelProject } from "@/lib/travel/projects"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ project: string; traveler: string }> },
) {
  const { project: projectSlug, traveler: travelerSlug } = await params
  const config = getTravelProject(projectSlug, travelerSlug)
  if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const viewer = await getTravelAccess(projectSlug, travelerSlug)
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const payload = await getTravelItinerary({
      baseId: config.project.airtableBaseId,
      projectSlug,
      travelerSlug,
      startDate: config.project.startDate,
      endDate: config.project.endDate,
    })
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[travel] itinerary sync failed", error)
    return NextResponse.json({ error: "sync_failed" }, { status: 502 })
  }
}

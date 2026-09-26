import { NextResponse, type NextRequest } from "next/server"
import { createEditorNote } from "@/lib/travel/airtable"
import { canReadEditorNotes, getTravelAccess } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/travel/projects"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; traveler: string }> },
) {
  const { project: projectSlug, traveler: travelerSlug } = await params
  const config = getTravelProject(projectSlug, travelerSlug)
  if (!config) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const viewer = await getTravelAccess(projectSlug, travelerSlug)
  if (!viewer) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  // Hiding the form is presentation; this is the rule. A client provisioned
  // against this page can reach the endpoint directly, and must not.
  if (!canReadEditorNotes(viewer)) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const origin = request.headers.get("origin")
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "origin_rejected" }, { status: 403 })
  }

  const body = (await request.json()) as { intakeId?: string; company?: string; note?: string }
  const intakeId = String(body.intakeId || "")
  const company = String(body.company || "").trim().slice(0, 160)
  const note = String(body.note || "").trim().slice(0, 5000)
  if (!/^rec[A-Za-z0-9]{14}$/.test(intakeId) || !company || !note) {
    return NextResponse.json({ error: "A company and note are required." }, { status: 400 })
  }

  try {
    const result = await createEditorNote({
      baseId: config.project.airtableBaseId,
      intakeId,
      company,
      note,
      author: viewer.name || config.traveler.displayName,
    })
    return NextResponse.json({ saved: true, result }, { status: 201 })
  } catch (error) {
    console.error("[travel] editor note save failed", error)
    return NextResponse.json({ error: "The editor note could not be saved." }, { status: 502 })
  }
}

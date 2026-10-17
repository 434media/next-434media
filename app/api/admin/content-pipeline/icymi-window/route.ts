import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSuperAdmin } from "../auth"

export const runtime = "nodejs"

const Body = z.object({ lookbackDays: z.number().int().min(1).max(60).nullable() })

/**
 * GET /api/admin/content-pipeline/icymi-window — the ICYMI lookback. PUT { "lookbackDays": 14 } widens it to the last
 * 14 days (1–60) for a test run; PUT { "lookbackDays": null } restores the default, the previous Monday-to-Sunday
 * week in America/Chicago. Stored beside the seeds in content_pipeline_config; takes effect on the next ICYMI job.
 */
export async function GET() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { getIcymiWindow } = await import("@/lib/firestore-content-pipeline")
    return NextResponse.json(await getIcymiWindow(), { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/content-pipeline/icymi-window]", err)
    return NextResponse.json({ error: "Could not read the ICYMI window" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Send { \"lookbackDays\": <1–60> } to widen, or { \"lookbackDays\": null } for the previous week" }, { status: 400 })
  const setting = { lookbackDays: parsed.data.lookbackDays, updatedAt: new Date().toISOString(), updatedBy: auth.session.email.toLowerCase() }
  try {
    const { saveIcymiWindow } = await import("@/lib/firestore-content-pipeline")
    await saveIcymiWindow(setting)
  } catch (err) {
    console.error("[PUT /api/admin/content-pipeline/icymi-window]", err)
    return NextResponse.json({ error: "Could not save the ICYMI window" }, { status: 500 })
  }
  console.info("[content-pipeline] icymi window", JSON.stringify(setting))
  return NextResponse.json({ ok: true, ...setting })
}

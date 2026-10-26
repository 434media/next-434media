import { NextResponse, type NextRequest } from "next/server"
import { requireContentRunner } from "../../content-pipeline/auth"
import { createProfile } from "../profile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/content/roundup-stories?brand=milcity&kind=icymi — the published posts an ICYMI row may recap (plan
 * v11.2.1 Step 4 item 1): last week's live News and Breaking posts with their cards, newest first, and how many a
 * roundup takes, under the brand's published profile (read fresh). Reads only; the Run job checks the ticks again.
 */
export async function GET(req: NextRequest) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const brand = req.nextUrl.searchParams.get("brand") ?? "", kind = req.nextUrl.searchParams.get("kind") ?? ""
  if (!/^[a-z0-9-]{2,40}$/.test(brand) || !/^[a-z0-9_]{2,30}$/.test(kind)) return NextResponse.json({ error: "Give a brand and a roundup template" }, { status: 400 })
  const p = await createProfile(brand)
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status })
  const [{ withProfile }, { createTemplates }, { liveRoundupChoices }] = await Promise.all([
    import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/create-table"), import("@/lib/content-pipeline/roundup"),
  ])
  if (!createTemplates(p.active.profile).find(t => t.kind === kind)?.roundup) return NextResponse.json({ error: "That brand has no such roundup template in its published profile" }, { status: 400 })
  try {
    // The engine's own items (with captions) stay on the server.
    const { window, min, max, stories, hold } = await withProfile(p.active, () => liveRoundupChoices())
    return NextResponse.json({ window, min, max, stories, ...(hold ? { hold } : {}), profileVersionId: p.active.versionId }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/content/roundup-stories]", err)
    return NextResponse.json({ error: "Could not read the published posts" }, { status: 500 })
  }
}

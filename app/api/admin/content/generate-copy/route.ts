import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import { createProfile } from "../profile"

export const runtime = "nodejs"
// Fact extraction, the write with its candidates, rewrites, fresh wording and fit: several model calls.
export const maxDuration = 300

const input = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.string().regex(/^[a-z0-9_]{2,30}$/),
  referenceLink: z.string().trim().url().max(2000).refine(u => u.startsWith("https://"), "https only"),
  notes: z.string().trim().max(1000).optional(),
}).strict()

/**
 * POST /api/admin/content/generate-copy — Human+ for one Create row: reads the reference link and drafts the card
 * fields and caption with the pipeline's writer, fact extraction and copy checks, under the brand's published profile
 * (read fresh). Writes nothing: the cells come back to the table, where the person edits them before Run job.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Give a Brand, a Template and an https reference link (notes optional)" }, { status: 400 })
  const a = parsed.data
  const p = await createProfile(a.brand)
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status })
  const [{ withProfile }, { createTemplates }, { humanPlus, humanPlusDeps, HumanPlusError }] = await Promise.all([
    import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/create-table"), import("@/lib/content-pipeline/human-plus"),
  ])
  const template = createTemplates(p.active.profile).find(t => t.kind === a.kind)
  if (!template) return NextResponse.json({ error: "That brand has no such template in its published profile" }, { status: 400 })
  try {
    const copy = await withProfile(p.active, async () => humanPlus(await humanPlusDeps(), {
      kind: template.kind, url: a.referenceLink, ...(a.notes ? { notes: a.notes } : {}), requestedBy: { actorEmail: auth.session.email.toLowerCase(), actorName: auth.session.name || "" },
    }))
    console.info("[content/generate-copy]", JSON.stringify({ by: auth.session.email, brand: a.brand, kind: a.kind, url: a.referenceLink, version: p.active.versionId, facts: copy.facts, hold: copy.hold ?? null, calls: copy.calls.map(c => c.model) }))
    // The model calls are logged above, not returned.
    return NextResponse.json({ fields: copy.fields, headline: copy.headline, subHeadline: copy.subHeadline, caption: copy.caption, notes: copy.notes, facts: copy.facts, ...(copy.hold ? { hold: copy.hold } : {}), source: copy.source, profileVersionId: p.active.versionId })
  } catch (err) {
    if (err instanceof HumanPlusError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[POST /api/admin/content/generate-copy] failed:", err)
    return NextResponse.json({ error: "Human+ could not draft this row just now; try again" }, { status: 502 })
  }
}

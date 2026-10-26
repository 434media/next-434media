import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireContentRunner } from "../../content-pipeline/auth"
import { createProfile } from "../profile"

export const runtime = "nodejs"
// Fact extraction, the write with its candidates, rewrites, fresh wording and fit: several model calls.
export const maxDuration = 300

const input = z.object({
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.string().regex(/^[a-z0-9_]{2,30}$/),
  referenceLink: z.string().trim().url().max(2000).refine(u => u.startsWith("https://"), "https only").optional(),
  /** An ICYMI roundup row: its ticked published posts, in order, in place of a reference link. */
  roundup: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).min(1).max(10).optional(),
  notes: z.string().trim().max(1000).optional(),
  mediaFrom: z.string().trim().url().max(2000).optional(),
}).strict().refine(v => !!v.referenceLink !== !!v.roundup, "a reference link or a roundup's stories")

/**
 * POST /api/admin/content/generate-copy — Human+ for one Create row: reads the reference link and drafts the card
 * fields and caption with the pipeline's writer, fact extraction and copy checks, under the brand's published profile
 * (read fresh). Writes nothing: the cells come back to the table, where the person edits them before Run job.
 */
export async function POST(req: NextRequest) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Give a Brand, a Template and an https reference link, or a roundup's ticked stories (notes optional)" }, { status: 400 })
  const a = parsed.data
  const p = await createProfile(a.brand)
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status })
  const [{ withProfile }, { createTemplates }, { humanPlus, humanPlusRoundup, humanPlusDeps, HumanPlusError }] = await Promise.all([
    import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/create-table"), import("@/lib/content-pipeline/human-plus"),
  ])
  const template = createTemplates(p.active.profile).find(t => t.kind === a.kind)
  if (!template) return NextResponse.json({ error: "That brand has no such template in its published profile" }, { status: 400 })
  if (!!template.roundup !== !!a.roundup) return NextResponse.json({ error: template.roundup ? `Tick ${template.roundup.min}–${template.roundup.max} published stories first` : "Paste an https reference link first" }, { status: 400 })
  // The roundup's size is the profile's, and each story is ticked once (the Run job checks the same).
  if (template.roundup && a.roundup && (a.roundup.length < template.roundup.min || a.roundup.length > template.roundup.max || new Set(a.roundup).size !== a.roundup.length)) {
    return NextResponse.json({ error: `Tick ${template.roundup.min}–${template.roundup.max} published stories, each once` }, { status: 400 })
  }
  const requestedBy = { actorEmail: auth.session.email.toLowerCase(), actorName: auth.session.name || "" }
  try {
    const copy = await withProfile(p.active, async () => {
      if (a.roundup) {
        // The ticked stories, checked against what the roundup may recap now (never the browser's titles or captions).
        const { liveRoundupChoices } = await import("@/lib/content-pipeline/roundup")
        const choices = await liveRoundupChoices(), items = a.roundup.map(id => choices.items.find(i => i.postId === id))
        if (items.some(i => !i)) throw new HumanPlusError("A ticked story is no longer a live post from the window; choose the stories again", 400)
        return humanPlusRoundup(await humanPlusDeps(), { kind: template.kind, items: items.filter(i => !!i), window: choices.window, ...(a.notes ? { notes: a.notes } : {}), ...(a.mediaFrom ? { mediaFrom: a.mediaFrom } : {}), requestedBy })
      }
      return humanPlus(await humanPlusDeps(), { kind: template.kind, url: a.referenceLink!, ...(a.notes ? { notes: a.notes } : {}), ...(a.mediaFrom ? { mediaFrom: a.mediaFrom } : {}), requestedBy })
    })
    console.info("[content/generate-copy]", JSON.stringify({ by: auth.session.email, brand: a.brand, kind: a.kind, url: a.referenceLink ?? null, roundup: a.roundup ?? null, version: p.active.versionId, facts: copy.facts, hold: copy.hold ?? null, calls: copy.calls.map(c => c.model) }))
    // The model calls are logged above, not returned.
    return NextResponse.json({ fields: copy.fields, headline: copy.headline, subHeadline: copy.subHeadline, caption: copy.caption, notes: copy.notes, facts: copy.facts, ...(copy.hold ? { hold: copy.hold } : {}), source: copy.source, profileVersionId: p.active.versionId })
  } catch (err) {
    if (err instanceof HumanPlusError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error("[POST /api/admin/content/generate-copy] failed:", err)
    return NextResponse.json({ error: "Human+ could not draft this row just now; try again" }, { status: 502 })
  }
}

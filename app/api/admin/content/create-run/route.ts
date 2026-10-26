import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireContentRunner } from "../../content-pipeline/auth"
import { createProfile } from "../profile"
import { isCreateUpload } from "@/lib/content-pipeline/create-media"

export const runtime = "nodejs"
// Two Canva fills, a video import and an MP4 render can take minutes.
export const maxDuration = 800

const text = (max: number) => z.string().max(max)
const row = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  brand: z.string().regex(/^[a-z0-9-]{2,40}$/),
  kind: z.string().regex(/^[a-z0-9_]{2,30}$/),
  referenceLink: z.string().max(2000).refine(v => v === "" || v.startsWith("https://"), "https only"),
  notes: text(1000),
  media: z.object({ url: z.string().url().max(2000), kind: z.enum(["image", "video"]), name: text(120), bytes: z.number().int().nonnegative().optional(), width: z.number().optional(), height: z.number().optional(), durationSec: z.number().optional(), optimized: z.string().max(20).optional() }).nullable(),
  platforms: z.array(z.string().max(40)).max(8),
  headline: text(400), subHeadline: text(400), caption: text(2200),
  date: z.string().max(10),
  fields: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), text(400)),
  copyVersionId: z.string().max(80).optional(),
  /** An ICYMI roundup row's ticked published posts, in order (the Run job checks them again). */
  roundup: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(10).optional(),
}).strict()

/**
 * POST /api/admin/content/create-run — Run job for one Create row: fills every Canva template the row's platforms need,
 * exports them and stages each on a content post in Review, under the brand's published profile (read fresh). One row
 * per request so the table shows each row's progress; idempotent on the row id, so a retry reuses what it made.
 */
export async function POST(req: NextRequest) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = row.safeParse((await req.json().catch(() => null))?.row)
  if (!parsed.success) return NextResponse.json({ error: "The row is incomplete or malformed" }, { status: 400 })
  const r = parsed.data
  if (r.media && !isCreateUpload(r.media.url)) return NextResponse.json({ error: "Media must be added through the table" }, { status: 400 })
  // The size picks Canva's video upload path; it is read from the store, never taken from the browser.
  if (r.media) {
    const stored = await (await import("@vercel/blob")).head(r.media.url).catch(() => null)
    if (!stored) return NextResponse.json({ error: "The row's media is no longer in storage; add it again" }, { status: 400 })
    r.media.bytes = stored.size
  }
  const p = await createProfile(r.brand)
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status })
  const [{ withProfile }, { runCreateRow, createRunDeps, CreateRowError }] = await Promise.all([import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/create-run")])
  try {
    const result = await withProfile(p.active, async () => runCreateRow(await createRunDeps(), r, { email: auth.session.email.toLowerCase(), name: auth.session.name || "" }))
    console.info("[content/create-run]", JSON.stringify({ by: auth.session.email, row: r.id, brand: r.brand, kind: r.kind, version: result.profileVersionId, posts: result.posts.map(x => ({ format: x.format, post: x.postId, design: x.designId, reused: x.reused })) }))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof CreateRowError) return NextResponse.json({ error: err.message, problems: err.problems }, { status: err.status })
    const name = err instanceof Error ? err.name : ""
    console.error("[POST /api/admin/content/create-run] failed:", r.id, err)
    // Canva and the export staging are upstream; their messages are safe to show (they never carry Canva's own text).
    if (name === "CanvaError" || name === "MetaBlocked") return NextResponse.json({ error: (err as Error).message }, { status: 502 })
    return NextResponse.json({ error: "The run could not finish this row; run it again (it resumes)" }, { status: 500 })
  }
}

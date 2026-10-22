import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireContentRunner } from "../../../content-pipeline/auth"
import { getContentPostsByCreateRow, updateContentPost, ownedMetaStore, decideOwnedMeta, approveHandPost, recordHandPost } from "@/lib/firestore-crm"
import { MetaBlocked } from "@/lib/owned-meta-publisher"
import { exportFileBase, isHandPosted, FORMAT_LABEL, type CreateFormat } from "@/lib/content-pipeline/create-table"
import { approveRow, exportAs, formatOf, frozen, futureDated, isApproved, platformsFor, resolveCanvaDesignLink, RowApprovalError } from "@/lib/content-pipeline/row-approval"
import { CreateRowError, createRequestId } from "@/lib/content-pipeline/create-run"
import { isCreateUpload } from "@/lib/content-pipeline/create-media"
import { createProfile } from "../../profile"
import { pipelineMarked } from "@/lib/content-pipeline/ownership"
import type { ContentPost, SocialPlatform } from "@/components/crm/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Refresh from Canva renders an MP4 for a 9:16 design (up to five minutes); publishing waits on Meta's processing.
export const maxDuration = 800

/**
 * /api/admin/content/rows/[rowId] — the approval drawer for one Create row (plan v11.1 Step 3 item 2). Gate: the admin
 * gate plus the content permission (super-admins and team members who run content). Every write is production-only,
 * like the publisher's own routes, since previews may share production Firestore; a preview can read.
 *
 *   GET    the row's variations, each with its publisher state
 *   PATCH  { caption?, date?, platforms?: { [postId]: SocialPlatform[] } } — edits never touch a design
 *   POST   { action: "refresh", postId }                         re-export the design from Canva (never refill)
 *          { action: "attach", designLink, format, postId?, pages? }   attach an existing Canva design by its link (a
 *                                                                canva.link short link is followed here); pages: {feed?, reels?}
 *                                                                fills each format from those pages of one design
 *          { action: "approve", shown: { [postId]: { fingerprint, caption, date, platforms } }, aiGenerated, aiRealisticMedia? }
 *                                                                Approve & Schedule, bound to everything shown
 *          { action: "publish", postId, hash, early? }           publish an approved variation to Instagram and Facebook;
 *                                                                a post dated after today needs early: true (Step 5 schedules)
 *          { action: "hand-post", postId, platform, url, fingerprint }   record a hand post's live link
 *          { action: "replace-media", media, text? }             Replace media (Step 3 part 4): fill every size from its
 *                                                                template again, with the row's card text and the new
 *                                                                photo or video; text is the browser's copy of the row,
 *                                                                used only for posts made before the text was kept
 */
const ROW_ID = /^[A-Za-z0-9_-]{8,64}$/
const PLATFORM = z.enum(["instagram", "facebook", "tiktok", "youtube", "linkedin"])
const PAGES = z.array(z.number().int().min(1).max(200)).min(1).max(10)
const patchBody = z.object({
  caption: z.string().max(2200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  platforms: z.record(z.string().max(64), z.array(PLATFORM).max(5)).optional(),
}).strict()
const TEXT = (max: number) => z.string().max(max)
const MEDIA = z.object({ url: z.string().url().max(2000), kind: z.enum(["image", "video"]), name: TEXT(120), bytes: z.number().int().nonnegative().optional(), width: z.number().optional(), height: z.number().optional(), durationSec: z.number().optional(), optimized: z.string().max(20).optional() }).strict()
const CARD_TEXT = z.object({ brand: z.string().regex(/^[a-z0-9-]{2,40}$/), kind: z.string().regex(/^[a-z0-9_]{2,30}$/), headline: TEXT(400), subHeadline: TEXT(400), fields: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), TEXT(400)) }).strict()
const postBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refresh"), postId: z.string().max(64) }),
  z.object({ action: z.literal("attach"), designLink: z.string().max(2000), format: z.enum(["feed", "reels"]), postId: z.string().max(64).optional(),
    pages: z.object({ feed: PAGES.optional(), reels: PAGES.optional() }).strict().optional() }),
  z.object({ action: z.literal("approve"), aiGenerated: z.boolean(), aiRealisticMedia: z.boolean().optional(), shown: z.record(z.string().max(64), z.object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/), caption: z.string().max(2200), date: z.string().max(10), platforms: z.array(PLATFORM).max(5),
  }).strict()) }),
  z.object({ action: z.literal("publish"), postId: z.string().max(64), hash: z.string().max(128), early: z.boolean().optional() }),
  z.object({ action: z.literal("hand-post"), postId: z.string().max(64), platform: PLATFORM, url: z.string().max(2000), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ action: z.literal("replace-media"), media: MEDIA, text: CARD_TEXT.optional() }).strict(),
])

const production = () => process.env.VERCEL_ENV === "production"
/** A variation's readable file names: brand, post date and the headline from its generated title. */
const fileBaseOf = (p: ContentPost) => exportFileBase(p.intake?.metaBrand || String(p.platform ?? ""), p.date_to_post ?? "", p.title.split(" — ").slice(1).join(" — ") || p.title)
const refuse = (error: string, status: number) => NextResponse.json({ error }, { status })

/** Each variation with its publisher batch (the exact manifest an approval binds), when it has one. */
async function rowView(rowId: string) {
  const posts = await getContentPostsByCreateRow(rowId)
  const store = ownedMetaStore()
  const variations = await Promise.all(posts.map(async post => {
    if (!post.owned_meta) return { post, batch: null }
    const batch = await store.read(post.id).then(r => r.batch).catch(() => null)
    return { post, batch: batch && { id: batch.id, hash: batch.hash, revision: batch.manifest.revision, approval: batch.approval ?? null, revoked: !!batch.revoked, claim: !!batch.claim, jobs: { instagram: { status: batch.jobs.instagram.status, permalink: batch.jobs.instagram.permalink ?? null, blocker: batch.jobs.instagram.blocker ?? null }, facebook: { status: batch.jobs.facebook.status, permalink: batch.jobs.facebook.permalink ?? null, blocker: batch.jobs.facebook.blocker ?? null } } } }
  }))
  return { variations, publisher: production() && await (await import("@/lib/owned-meta-execution")).ownedMetaDeploymentEnabled() }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ rowId: string }> }) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rowId = (await ctx.params).rowId ?? ""
  if (!ROW_ID.test(rowId)) return refuse("Unknown row", 400)
  try {
    const view = await rowView(rowId)
    if (!view.variations.length) return refuse("No posts for this row", 404)
    return NextResponse.json(view, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/content/rows] read failed:", rowId, err)
    return refuse("Could not read the row", 500)
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ rowId: string }> }) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rowId = (await ctx.params).rowId ?? ""
  const parsed = patchBody.safeParse(await req.json().catch(() => null))
  if (!ROW_ID.test(rowId) || !parsed.success) return refuse("Invalid edit", 400)
  const edit = parsed.data
  if (!production()) return refuse("Edits happen on the live site only", 423)
  const posts = await getContentPostsByCreateRow(rowId)
  if (!posts.length) return refuse("No posts for this row", 404)
  // Every variation is checked before anything is written, so a refusal changes nothing. The writes then go one
  // variation at a time (each through the guarded update); if one fails, the response says to reload and see what saved.
  const plan: { post: ContentPost; updates: Partial<ContentPost> }[] = []
  for (const id of Object.keys(edit.platforms ?? {})) if (!posts.some(x => x.id === id)) return refuse("A variation changed; reload", 409)
  for (const p of posts) {
    const updates: Partial<ContentPost> = {}
    const platforms = edit.platforms?.[p.id]
    if (platforms && [...new Set(platforms)].sort().join() !== [...(p.social_platforms ?? [])].sort().join()) {
      const bad = platforms.filter(x => !platformsFor(formatOf(p)).includes(x))
      if (bad.length) return refuse(`${FORMAT_LABEL[formatOf(p)]} can't go to ${bad.join(", ")}`, 400)
      if (frozen(p)) return refuse(`${FORMAT_LABEL[formatOf(p)]} is already out or publishing; its platforms can't change`, 409)
      updates.social_platforms = [...new Set(platforms)] as SocialPlatform[]
    }
    // A variation already out keeps the caption and date it went out with; the rest of the row takes the edit.
    if (!frozen(p)) {
      if (edit.caption !== undefined && edit.caption !== (p.social_copy ?? "")) updates.social_copy = edit.caption
      if (edit.date !== undefined && edit.date !== p.date_to_post) updates.date_to_post = edit.date
    }
    // A publisher approval is reset by the guarded update (owned-meta-publisher guardedContentUpdate); a hand-post
    // approval is reset here, so an approval always covers what goes out.
    if (Object.keys(updates).length && isApproved(p) && !p.owned_meta) updates.status = "needs_approval"
    if (Object.keys(updates).length) plan.push({ post: p, updates })
  }
  try {
    for (const { post, updates } of plan) await updateContentPost(post.id, updates)
    return NextResponse.json(await rowView(rowId))
  } catch (err) {
    console.error("[PATCH /api/admin/content/rows] edit failed:", rowId, err)
    return NextResponse.json({ ...(await rowView(rowId).catch(() => ({}))), error: "Could not save the edit; reload to see what was saved" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ rowId: string }> }) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const rowId = (await ctx.params).rowId ?? ""
  const parsed = postBody.safeParse(await req.json().catch(() => null))
  if (!ROW_ID.test(rowId) || !parsed.success) return refuse("Invalid request", 400)
  const body = parsed.data, email = auth.session.email.toLowerCase(), name = auth.session.name?.trim() || auth.session.email
  if (!production()) return refuse("Approving, publishing and changing designs happen on the live site only", 423)
  try {
    const posts = await getContentPostsByCreateRow(rowId)
    if (!posts.length) return refuse("No posts for this row", 404)
    const inRow = (id: string) => posts.find(p => p.id === id)

    if (body.action === "refresh" || body.action === "attach") {
      // What to export onto which variation: one target for a refresh or a plain attach, one per format when a design's
      // pages fill several formats. Every target is checked before anything is exported.
      const targets: { post?: ContentPost; format: CreateFormat; pages?: number[] }[] = []
      let designId: string
      if (body.action === "refresh") {
        const post = inRow(body.postId)
        if (!post?.canva_design_id) return refuse("This variation has no Canva design to refresh", 409)
        if (frozen(post)) return refuse("This variation is already out or publishing; its design can't change", 409)
        designId = post.canva_design_id
        targets.push({ post, format: formatOf(post), ...(post.canva_pages?.length ? { pages: post.canva_pages } : {}) })
      } else {
        const id = await resolveCanvaDesignLink(body.designLink, fetch).catch(() => null)
        if (!id) return refuse("Paste a Canva design link (canva.com/design/… or a canva.link share link)", 400)
        designId = id
        const byPage = Object.entries(body.pages ?? {}).filter((e): e is [CreateFormat, number[]] => !!e[1]?.length)
        if (body.postId) {
          const post = inRow(body.postId)
          if (!post) return refuse("A variation changed; reload", 409)
          if (frozen(post)) return refuse("This variation is already out or publishing; its design can't change", 409)
          // An existing variation keeps its own format.
          targets.push({ post, format: formatOf(post), ...(body.pages?.[formatOf(post)] ? { pages: body.pages[formatOf(post)] } : {}) })
        } else if (byPage.length) {
          for (const [format, pages] of byPage) targets.push({ post: posts.find(p => formatOf(p) === format && !p.canva_design_id), format, pages })
        } else targets.push({ post: posts.find(p => formatOf(p) === body.format && !p.canva_design_id), format: body.format })
      }
      const [{ ownedMetaConnectorDeps, canvaDeps }, { attachExports }, { exportDesignJpg, exportDesignMp4, CanvaError }, crm] = await Promise.all([
        import("@/lib/owned-meta-execution"), import("@/lib/owned-meta-intake"), import("@/lib/canva-export"), import("@/lib/firestore-crm"),
      ])
      const tools = await ownedMetaConnectorDeps()
      // One design may fill several variations of this row (by page); never a post outside it.
      const bound = await crm.findContentPostByCanvaDesignId(designId)
      if (bound && !bound.archived && bound.create_row_id !== rowId && !targets.some(t => t.post?.id === bound.id)) return refuse(`That design is already on another post (${bound.title})`, 409)
      const { deps } = await canvaDeps()
      if (!deps) throw new CanvaError("Canva integration is not configured")
      const exported: { target: typeof targets[number]; urls: string[]; as: "mp4" | "jpg" }[] = []
      for (const target of targets) {
        const as = exportAs(target.post ?? { create_format: target.format, assets: [] }, target.format)
        const urls = as === "mp4" ? await exportDesignMp4(deps, { designId, ...(target.pages ? { pages: target.pages } : {}) }) : await exportDesignJpg(deps, { designId, ...(target.pages ? { pages: target.pages } : {}) })
        if (!urls.length) return refuse("Canva returned no export for this design", 502)
        exported.push({ target, urls, as })
      }
      const holds: string[] = []
      let unchanged = true
      for (const { target, urls, as } of exported) {
        let post = target.post
        const format = target.format
        if (!post) {
          // A new variation in this row, from the row's own values: its title is the row's (the board shows the format).
          const base = posts[0], now = new Date().toISOString()
          const allowed = platformsFor(format)
          const platforms = (base.social_platforms ?? []).filter(x => allowed.includes(x))
          post = await crm.createContentPost(pipelineMarked({
            user: base.user, date_created: now.slice(0, 10), platform: base.platform ?? "", status: "needs_approval",
            title: base.title.replace(/ · (Feed 4:5|Reels 9:16)/, "").slice(0, 200),
            notes: `Attached by link in the approval drawer (Canva design ${designId}${target.pages ? `, page ${target.pages.join(", ")}` : ""}).`,
            social_copy: base.social_copy ?? "", links: base.links ?? [], assets: [], tags: base.tags,
            social_platforms: platforms.length ? platforms : ["instagram", "facebook"], date_to_post: base.date_to_post,
            ...(base.profile_version_id ? { profile_version_id: base.profile_version_id } : {}),
            create_row_id: rowId, create_format: format, ...(target.pages ? { canva_pages: target.pages } : {}),
            intake: { requestId: `${createRequestId(rowId, format)}:link:${designId}${target.pages ? `:p${target.pages.join("-")}` : ""}`, metaBrand: base.intake?.metaBrand ?? "", requestedBy: email, at: now },
          } as Omit<ContentPost, "id" | "created_at" | "updated_at">))
          posts.push(post)
        }
        const items = as === "mp4" ? [{ url: urls[0], label: `${format}-video` }] : urls.map((url, n) => ({ url, label: `${format}-page-${target.pages?.[n] ?? n + 1}` }))
        // New files void an approval: the publisher's guarded update resets its own; a hand-post approval is reset in
        // the same write as the files, so the post is never "approved" with files nobody saw.
        const resetHand = isApproved(post) && !post.owned_meta
        const pagesChange = body.action === "attach" ? { canva_pages: target.pages ?? [] } : {}
        const intake = { ...tools.intake, setAssets: (id: string, assets: ContentPost["assets"], record: { export_fingerprint: string; export_staged_at: string; canva_design_id?: string }) => updateContentPost(id, { assets, ...record, ...pagesChange, ...(resetHand ? { status: "needs_approval" as const } : {}) }) }
        const attached = await attachExports(intake, { postId: post.id, items, randomId: tools.randomId, canva: { designId, ...(target.pages ? { pages: target.pages } : {}) }, fileBase: fileBaseOf(post), ...(body.action === "attach" && post.canva_design_id !== designId ? { rebind: true } : {}) })
        holds.push(...attached.holds)
        unchanged &&= attached.reused
        console.info("[content/rows]", JSON.stringify({ by: email, row: rowId, action: body.action, post: post.id, design: designId, pages: target.pages ?? null, reused: attached.reused }))
      }
      return NextResponse.json({ ...(await rowView(rowId)), holds: [...new Set(holds)], unchanged })
    }

    if (body.action === "replace-media") {
      const media = body.media
      if (!isCreateUpload(media.url) || media.optimized !== "done") return refuse("Add the new media here (a file or a Canva design link) and wait for it to finish", 400)
      // The size picks Canva's video upload path; it is read from the store, never taken from the browser.
      const stored = await (await import("@vercel/blob")).head(media.url).catch(() => null)
      if (!stored) return refuse("The new media is no longer in storage; add it again", 400)
      media.bytes = stored.size
      // The card text the Run job kept on the posts; a row made before it was kept uses the browser's copy of the row.
      const made = posts.filter(p => p.intake?.requestId === createRequestId(rowId, formatOf(p)))
      const text = made.find(p => p.create_text)?.create_text ?? body.text
      if (!made.length) return refuse("Nothing in this row was made from a template; use One-off to attach a finished design", 409)
      if (!text) return refuse("This row's card text isn't on the server; open the drawer in the browser whose Create table made the row, or use One-off", 409)
      const profile = await createProfile(text.brand)
      if ("error" in profile) return refuse(profile.error, profile.status)
      const [{ withProfile }, { replaceRowMedia, createRunDeps }] = await Promise.all([import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/create-run")])
      const result = await withProfile(profile.active, async () => replaceRowMedia(await createRunDeps(), rowId, text, media, { email, name }))
      console.info("[content/rows]", JSON.stringify({ by: email, row: rowId, action: "replace-media", kind: media.kind, version: result.profileVersionId, posts: result.posts.map(x => ({ format: x.format, post: x.postId, design: x.designId, reused: x.reused })) }))
      // A One-off variation (attached by link) has no template to re-fill; the drawer says so.
      const oneOff = posts.filter(p => !result.posts.some(x => x.postId === p.id) && !frozen(p)).map(p => FORMAT_LABEL[formatOf(p)])
      const holds = [...result.posts.flatMap(x => x.holds), ...(oneOff.length ? [`Not changed (One-off design): ${oneOff.join(", ")}`] : [])]
      return NextResponse.json({ ...(await rowView(rowId)), holds: [...new Set(holds)] })
    }

    if (body.action === "approve") {
      const [{ prepareOwnedMetaBatch }, { preflightFor }, { exportFingerprint }] = await Promise.all([import("@/lib/owned-meta-execution"), import("@/lib/owned-meta-tool"), import("@/lib/owned-meta-intake")])
      const reviewer = { email, name }
      const approved = await approveRow({
        listRow: getContentPostsByCreateRow,
        prepare: prepareOwnedMetaBatch,
        preflight: b => preflightFor(b.manifest),
        decide: (id, revision, hash) => decideOwnedMeta(id, revision, hash, "approved", reviewer, "Approved in the drawer"),
        approveHand: (id, shown) => approveHandPost(id, shown, reviewer, isHandPosted),
        fingerprintOf: exportFingerprint,
      }, rowId, body.shown, { aiGenerated: body.aiGenerated, ...(body.aiRealisticMedia !== undefined ? { aiRealisticMedia: body.aiRealisticMedia } : {}) })
      console.info("[content/rows]", JSON.stringify({ by: email, row: rowId, action: "approve", approved }))
      return NextResponse.json({ ...(await rowView(rowId)), approved })
    }

    if (body.action === "publish") {
      const post = inRow(body.postId)
      if (!post?.owned_meta) return refuse("This variation has no approved publisher manifest", 409)
      const { executeOwnedMeta, recordOwnedMetaFailure } = await import("@/lib/owned-meta-execution")
      const store = ownedMetaStore(), record = await store.read(post.id)
      if (record.batch.hash !== body.hash || !record.batch.approval) return refuse("The approved version changed; reload", 409)
      // Publish now posts at once; until scheduled publishing (plan Step 5), a post dated after today needs a confirmation.
      if (futureDated(post) && !body.early) return NextResponse.json({ error: `This post is dated ${post.date_to_post}. Publish now posts it today; confirm to publish early, or wait for scheduling.`, futureDate: post.date_to_post }, { status: 409 })
      const runId = crypto.randomUUID(), startedAt = new Date().toISOString()
      try {
        await executeOwnedMeta({ id: post.id, runId, record, store, trigger: "admin-drawer" })
      } catch (error) {
        const failure = await recordOwnedMetaFailure({ id: post.id, runId, batchId: record.batch.id, brand: record.batch.manifest.brand, error, startedAt, run: true, trigger: "admin-drawer" })
        return NextResponse.json({ ...(await rowView(rowId)), error: failure.message }, { status: failure.status })
      }
      return NextResponse.json(await rowView(rowId))
    }

    // hand-post
    const post = inRow(body.postId)
    if (!post) return refuse("A variation changed; reload", 409)
    let url: URL
    try { url = new URL(body.url) } catch { return refuse("Paste the post's https link", 400) }
    if (url.protocol !== "https:") return refuse("Paste the post's https link", 400)
    await recordHandPost(post.id, { platform: body.platform, url: url.toString(), by: email, expectedFingerprint: body.fingerprint }, isHandPosted)
    return NextResponse.json(await rowView(rowId))
  } catch (err) {
    if (err instanceof CreateRowError) return NextResponse.json({ error: err.message, problems: err.problems }, { status: err.status })
    if (err instanceof RowApprovalError) return NextResponse.json({ error: err.message, problems: err.problems }, { status: err.status })
    if (err instanceof MetaBlocked) return refuse(err.message, 409)
    const errName = err instanceof Error ? err.name : ""
    console.error("[POST /api/admin/content/rows] failed:", rowId, body.action, err)
    // Canva's messages are ours (never its vendor text), so they are safe to show.
    if (errName === "CanvaError") return refuse((err as Error).message, 502)
    return refuse("The action could not finish; reload and try again", 500)
  }
}

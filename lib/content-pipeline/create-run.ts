import { BRAND, activeProfile } from "./brand"
import { SERIES, checkFields, normalizeFields } from "./series"
import { contentPropertyOf } from "./properties"
import { pipelineMarked, adoptablePost, PIPELINE_KEY_PREFIX } from "./ownership"
import { FORMAT_LABEL, createTemplates, storySlotUsed, ddmmmyy, designText, exportFileBase, formatsOf, mediaShapeOf, rowProblems, SOCIAL_LABEL, type CreateSocial, type CreateFormat, type CreateRow, type CreateTemplate, type RoundupStory, type StoryCard, type StoryCardTemplate } from "./create-table"
import { allowedPlatforms, frozen, isApproved } from "./row-approval"
import { createHash } from "node:crypto"
import type { ContentPost, CreateText, RoundupSlide } from "@/components/crm/types"
import { canvaEditUrl, type CreateInput, type CreatedDesign } from "../canva-create"
import { CanvaError } from "../canva-export"

/**
 * Run job for one Create row (plan v11 Step 2), inside withProfile() with the brand's published profile read fresh by
 * the route. Each format the row's platforms need gets its brand template filled (the row's text, its photo or video
 * in the template's image field), exported, and staged on its own content post in Review (needs_approval). Nothing is
 * prepared, approved or published. Idempotent on the row id and what the design is made from: the post's intake.requestId
 * is keyed `admin:create:<row>:<format>` (the pipeline's reserved prefix), and the Canva ledger adds a hash of the
 * template, the card text and the media, so a retried run reuses its designs and posts, while a run after the row's
 * text or media changed makes a new design and puts it on the same post (Step 3 part 2: the "TEST" / 0:05 design).
 */
export interface CreateRunDeps {
  templateFields(templateId: string): Promise<Record<string, string>>
  createDesign(input: CreateInput): Promise<CreatedDesign>
  /** JPG pages (feed with a photo) or one MP4 (a video, and every Reels design), as download URLs. */
  exportDesign(designId: string, as: "jpg" | "mp4"): Promise<string[]>
  findByRequestId(requestId: string): Promise<ContentPost | null>
  createPost(post: Omit<ContentPost, "id" | "created_at" | "updated_at">): Promise<ContentPost>
  /** The guarded update: a changed caption, date or platforms sends an approved post back for approval. */
  updatePost(id: string, updates: Partial<ContentPost>): Promise<ContentPost>
  /**
   * `rebind`: the post takes a new design in place of its old one (a re-run after the row changed). `canvaItems`: how
   * many of the items, from the first, are the design's pages (a roundup's published cards follow them as they are).
   */
  attachExports(input: { postId: string; items: { url: string; label: string }[]; canva: { designId: string }; canvaItems?: number; fileBase: string; rebind?: boolean }): Promise<{ holds: string[]; assets?: { url?: string; duration?: number }[] }>
  /** The published posts a roundup may recap now (last week's live News and Breaking posts with their cards), newest first. */
  roundupStories(): Promise<RoundupStory[]>
  /**
   * Claims the row for one run, atomically (a Firestore transaction): false while another run of it holds an unexpired
   * lease. Two tabs or a double click can't then fill two designs and stage two Review posts, since the Canva ledger
   * and the post lookup are read-then-write.
   */
  claimRow(rowId: string, by: string): Promise<boolean>
  releaseRow(rowId: string): Promise<void>
  /** Send back to Review: an approved post's approval is withdrawn (firestore-crm sendBackToReview). */
  sendBack(postId: string, actor: { email: string; name: string }): Promise<void>
  now(): string
}
export interface CreatedPost { format: CreateFormat; postId: string; designId: string; editUrl: string; previewUrl?: string; holds: string[]; reused: boolean }
export class CreateRowError extends Error {
  constructor(readonly problems: string[], readonly status: 400 | 409 | 502 = 400) { super(problems.join("; ")) }
}

/**
 * A video design exported at Canva's default page timing (5 s) most likely cut the clip: the MCU MASTER video templates'
 * pages were timed at 5 s, not to the video (Step 3 part 5). Our export asks only for MP4 at 1080p; Canva takes the
 * length from the design's page timing. The Review card says so, so nobody approves a cut clip by mistake.
 */
export const SHORT_EXPORT_SEC = 5.05
export function shortExportHolds(format: CreateFormat, media: Pick<NonNullable<CreateRow["media"]>, "kind"> | null, assets: { duration?: number }[] = []): string[] {
  const d = assets.find(a => a.duration !== undefined)?.duration
  return media?.kind === "video" && d !== undefined && d <= SHORT_EXPORT_SEC
    ? [`The ${FORMAT_LABEL[format]} video is only 0:0${Math.round(d)} long: the template's page timing may have cut the clip. Check it before approving; if it's cut, fix the template's timing in Canva, then Replace media.`]
    : []
}

export const createRequestId = (rowId: string, format: CreateFormat) => `${PIPELINE_KEY_PREFIX}create:${rowId}:${format}`

/** What a design is made from: its template, card text and media (and a roundup's cards after it). A change makes a new design. */
export function designInputHash(input: { templateId: string; text: Record<string, string>; media?: { kind: string; url: string; bytes?: number } | null; slides?: readonly RoundupSlide[] }): string {
  const text = Object.fromEntries(Object.entries(input.text).sort(([a], [b]) => a.localeCompare(b)))
  return createHash("sha256").update(JSON.stringify({ t: input.templateId, text, m: input.media ? { k: input.media.kind, u: input.media.url, b: input.media.bytes ?? 0 } : null, ...(input.slides?.length ? { s: input.slides.map(x => x.card ? `card:${x.card.key}` : x.url) } : {}) })).digest("hex").slice(0, 16)
}

/** What a made story card is made from: its headline, deck and photo. A change makes a new card. */
export const storyCardKey = (c: StoryCard) => createHash("sha256").update(JSON.stringify([c.headline.trim(), c.deck.trim(), c.media?.url ?? ""])).digest("hex").slice(0, 12)

/**
 * A roundup's chosen stories as slides, checked again on the server against what may be recapped now (Step 4 item 1):
 * each must still be a live News or Breaking post from the window, with its card. The browser's list is never trusted.
 */
export async function roundupSlides(deps: Pick<CreateRunDeps, "roundupStories">, ids: readonly string[], cards: CreateRow["storyCards"] = {}): Promise<RoundupSlide[]> {
  const live = await deps.roundupStories()
  const missing = ids.filter(id => !live.some(s => s.postId === id))
  if (missing.length) throw new CreateRowError([`${missing.length === 1 ? "A ticked story is" : `${missing.length} ticked stories are`} no longer a live post from the window (${missing.join(", ")}); choose the stories again`], 409)
  return ids.map((id, i) => {
    const s = live.find(x => x.postId === id)!
    if (s.card) return { postId: s.postId, url: s.card, title: s.title }
    // A video story has no still card: the run makes one from the row's card text and photo.
    const c = cards[id]
    if (!c) throw new CreateRowError([`Story ${i + 1} (${s.title}) is a video post: write its card headline and add a photo`])
    return { postId: s.postId, url: "", title: s.title, card: { key: storyCardKey(c) } }
  })
}
/**
 * A roundup run's slides. A re-run of a row whose post already holds its slides, for the same ticks in the same order,
 * resumes with those (a run that failed on Sunday and is retried on Monday must not find its stories "gone" because
 * the window moved); only new or changed ticks are checked against what may be recapped now.
 */
async function slidesForRun(deps: Pick<CreateRunDeps, "roundupStories" | "findByRequestId">, row: Pick<CreateRow, "id" | "roundup" | "storyCards">): Promise<RoundupSlide[]> {
  const ids = row.roundup ?? []
  const prior = adoptablePost(await deps.findByRequestId(createRequestId(row.id, "feed")))?.roundup_slides
  // A made card whose text or photo changed since is made again; the rest are reused as they were.
  if (prior?.length && prior.length === ids.length && prior.every((s, i) => s.postId === ids[i])) return prior.map(s => {
    const c = s.card && row.storyCards?.[s.postId]
    return c && storyCardKey(c) !== s.card!.key ? { postId: s.postId, url: "", title: s.title, card: { key: storyCardKey(c) } } : s
  })
  return roundupSlides(deps, ids, row.storyCards)
}

/** A made card's text as the template takes it, checked against the ICYMI story series' limits. */
export function storyCardText(card: StoryCard, n: number, of: number): { text: Record<string, string>; problems: string[] } {
  const series = SERIES.icymi_story
  if (!series) return { text: {}, problems: ["the profile has no ICYMI story series"] }
  const written = normalizeFields(series, { headline: card.headline, deck: card.deck })
  const own = { ...series, fields: series.fields.filter(f => f.name === "headline" || f.name === "deck") }
  const problems = checkFields(own, written).filter(p => !(p.startsWith("Deck") && !card.deck.trim()))
  const text: Record<string, string> = { counter: `${String(n).padStart(2, "0")} / ${String(of).padStart(2, "0")}` }
  for (const [k, v] of Object.entries(written)) if ((k === "headline" || k === "deck") && v.trim()) text[k] = v.trim()
  return { text, problems: problems.map(p => `Story ${n}'s card: ${p}`) }
}

/** Makes the cards a roundup's video stories need (slides with no url), from the ICYMI story template, as JPGs. */
async function makeStoryCards(deps: Pick<CreateRunDeps, "templateFields" | "createDesign" | "exportDesign">, t: StoryCardTemplate | undefined, slides: RoundupSlide[], row: Pick<CreateRow, "storyCards">, postKey: string): Promise<RoundupSlide[]> {
  const todo = slides.map((s, i) => ({ s, i })).filter(x => !x.s.url)
  if (!todo.length) return slides
  if (!t) throw new CreateRowError(["A ticked story is a video post, and this brand has no ICYMI story template to make its card"])
  const dataset = await deps.templateFields(t.template)
  if (dataset[t.media] !== "image") throw new CreateRowError([`The ICYMI story template has no photo frame "${t.media}"`])
  const out = [...slides]
  for (const { s, i } of todo) {
    const c = row.storyCards![s.postId]!
    const { text } = storyCardText(c, i + 1, slides.length)
    for (const k of Object.keys(text)) if (dataset[k] !== "text") delete text[k]
    const design = await deps.createDesign({ requestId: `${postKey}:card:${s.postId}:${s.card!.key}`, templateId: t.template, title: `ICYMI story ${i + 1}: ${s.title}`.slice(0, 200), text, image: { field: t.media, url: c.media!.url, name: c.media!.name } })
    const urls = design.previewUrls.length ? design.previewUrls : await deps.exportDesign(design.designId, "jpg")
    if (!urls.length) throw new CreateRowError([`Canva returned no export for story ${i + 1}'s card`], 502)
    out[i] = { ...s, url: urls[0], card: { key: s.card!.key, designId: design.designId } }
  }
  return out
}
/** The export items for a design's pages, then a roundup's published cards as they are. */
function exportItems(format: CreateFormat, urls: string[], asVideo: boolean, slides: readonly RoundupSlide[] = []) {
  const pages = asVideo ? [{ url: urls[0], label: `${format}-video` }] : urls.map((url, n) => ({ url, label: `${format}-page-${n + 1}` }))
  return { items: [...pages, ...slides.map((x, n) => ({ url: x.url, label: `story-${n + 1}` }))], canvaItems: pages.length }
}

/** The row checked against the brand's published profile: the table's own checks, then the template's field limits. */
export function serverRowProblems(row: CreateRow): { template?: CreateTemplate; problems: string[] } {
  const template = createTemplates(activeProfile().profile).find(t => t.kind === row.kind)
  const problems = rowProblems(row, template)
  if (!template || problems.length) return { template, problems }
  const series = SERIES[template.series]
  // A roundup's cover is checked on the story rows it uses; the rest stay unfilled (designText).
  const cells = template.roundup ? template.fields.filter(f => storySlotUsed(f.name, row.roundup?.length ?? 0)) : template.fields
  const values: Record<string, string> = {}
  for (const f of cells) values[f.name] = f.role === "headline" ? row.headline : f.role === "subHeadline" ? row.subHeadline : row.fields[f.name] ?? ""
  // The server fills the rest (dates, labels); the person's text is checked as the card will set it (uppercase, lines).
  const written = Object.fromEntries(Object.entries(normalizeFields(series, values)).filter(([k]) => cells.some(f => f.name === k)))
  const own = { ...series, fields: series.fields.filter(f => cells.some(x => x.name === f.name)) }
  problems.push(...checkFields(own, written))
  if (row.caption.length > 2100) problems.push("Caption is longer than Instagram allows (2,200 characters with credits)")
  if (/@[A-Za-z0-9_.]{2,}/.test(row.caption)) problems.push("Caption contains an @handle; use plain names (account tags are added by hand)")
  return { template, problems }
}

export async function runCreateRow(deps: CreateRunDeps, row: CreateRow, actor: { email: string; name: string }): Promise<{ posts: CreatedPost[]; profileVersionId: string }> {
  const { versionId } = activeProfile()
  const { template, problems } = serverRowProblems(row)
  if (!template || problems.length) throw new CreateRowError(problems)
  if (!await deps.claimRow(row.id, actor.email)) throw new CreateRowError(["This row is already running (another tab or click); wait for it to finish"], 409)
  try { return { posts: await runClaimedRow(deps, row, template, actor, versionId), profileVersionId: versionId } }
  finally { await deps.releaseRow(row.id).catch(err => console.error("[create-run] release failed:", row.id, err)) }
}

async function runClaimedRow(deps: CreateRunDeps, row: CreateRow, template: CreateTemplate, actor: { email: string; name: string }, versionId: string): Promise<CreatedPost[]> {
  const posts: CreatedPost[] = []
  let slides = template.roundup ? await slidesForRun(deps, row) : []
  // Every card the run will make is checked before anything is made.
  if (template.roundup) {
    const problems = slides.flatMap((s, i) => s.url ? [] : storyCardText(row.storyCards?.[s.postId] ?? { headline: "", deck: "", media: null }, i + 1, slides.length).problems)
    if (problems.length) throw new CreateRowError(problems)
  }
  for (const { format, platforms } of formatsOf(row.platforms)) {
    const postKey = createRequestId(row.id, format)
    const existing = adoptablePost(await deps.findByRequestId(postKey))
    const filled = await fillFormat(deps, template, row, format, slides)
    const { inputHash } = filled
    if (existing?.assets.length && existing.export_fingerprint && existing.canva_design_id && existing.create_input_hash === inputHash) {
      posts.push({ format, postId: existing.id, designId: existing.canva_design_id, editUrl: canvaEditUrl(existing.canva_design_id), previewUrl: existing.assets[0]?.url, holds: [], reused: true })
      continue
    }
    // A post made before designs were hashed that is already out stays as it is: the run reuses it, as it did then.
    if (existing?.canva_design_id && !existing.create_input_hash && frozen(existing)) {
      posts.push({ format, postId: existing.id, designId: existing.canva_design_id, editUrl: canvaEditUrl(existing.canva_design_id), previewUrl: existing.assets[0]?.url, holds: [], reused: true })
      continue
    }
    if (existing && frozen(existing)) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post from this row is already out or publishing; its design can't change. Start a new row.`], 409)
    // The board title leaves the format out (the card shows it); the files carry brand, date and headline.
    const headline = template.roundup ? `${slides.length} stories, ${ddmmmyy(row.date)}` : row.headline
    const title = `${BRAND.shortName} ${template.label} — ${headline.replace(/\s+/g, " ").trim()}`.slice(0, 200)
    const { design, urls, asVideo } = await filled.make(`${postKey}:${inputHash}`, title)
    if (template.roundup) slides = await makeStoryCards(deps, template.roundup.storyCard, slides, row, postKey)
    const now = deps.now()
    const notes = [`Made in the Create table (${template.label}, ${FORMAT_LABEL[format]}).`, row.referenceLink ? `Reference: ${row.referenceLink}` : "", ...slides.map((x, i) => `Story ${i + 1}: ${x.title} (${x.postId})`), row.notes.trim() ? `Notes: ${row.notes.trim()}` : ""].filter(Boolean).join("\n").slice(0, 4000)
    const roundup = template.roundup ? { roundup_slides: slides } : {}
    const post = existing
      // A re-run after the row changed: the post takes the row's current text with the new design.
      ? await deps.updatePost(existing.id, { title, notes, social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId, ...roundup })
      : await deps.createPost(pipelineMarked({
        user: actor.name || actor.email, date_created: now.slice(0, 10), platform: contentPropertyOf(BRAND.id), status: "needs_approval", title, notes,
        social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], assets: [], tags: BRAND.posts.tag,
        social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId,
        ...(row.copyVersionId && row.copyVersionId !== versionId ? { copy_profile_version_id: row.copyVersionId } : {}),
        create_row_id: row.id, create_format: format, ...roundup,
        intake: { requestId: postKey, metaBrand: BRAND.posts.metaBrand, requestedBy: actor.email, at: now },
      } as Omit<ContentPost, "id" | "created_at" | "updated_at">))
    const { items, canvaItems } = exportItems(format, urls, asVideo, slides)
    const attached = await deps.attachExports({ postId: post.id, items, canva: { designId: design.designId }, ...(slides.length ? { canvaItems } : {}), fileBase: exportFileBase(BRAND.id, row.date, template.roundup ? template.label : row.headline), ...(existing ? { rebind: true } : {}) })
    // A made card is kept as its stored copy (Canva's export links expire), so Refresh and Replace media can put it back.
    if (slides.some(s => s.card)) slides = slides.map((s, i) => s.card ? { ...s, url: attached.assets?.[canvaItems + i]?.url ?? s.url } : s)
    await deps.updatePost(post.id, { create_input_hash: inputHash, create_text: createTextOf(row), create_media: mediaShapeOf(row.media), ...(template.roundup ? { roundup_slides: slides } : {}) })
    posts.push({ format, postId: post.id, designId: design.designId, editUrl: canvaEditUrl(design.designId), previewUrl: design.previewUrls[0], holds: [...attached.holds, ...shortExportHolds(format, row.media, attached.assets), ...(design.folderProblem ? [design.folderProblem] : [])], reused: false })
  }
  return posts
}

/**
 * The row's card text and template, kept on each post so Replace media can re-fill the designs (Step 3 part 4). The
 * card's printed date is kept as it was printed (fields.date), so a later change of the post date never moves it.
 */
export const createTextOf = (row: Pick<CreateRow, "brand" | "kind" | "headline" | "subHeadline" | "fields" | "date" | "roundup">): CreateText =>
  ({ brand: row.brand, kind: row.kind, headline: row.headline, subHeadline: row.subHeadline, fields: { ...row.fields, date: row.fields.date?.trim() || ddmmmyy(row.date) }, ...(row.roundup?.length ? { roundup: [...row.roundup] } : {}) })

/**
 * One format's design input, checked against its template; make() fills the template in Canva and exports it. The
 * Run job and Replace media share it, so both hash a design the same way (designInputHash) and an approval is voided
 * by the same new files.
 */
async function fillFormat(deps: Pick<CreateRunDeps, "templateFields" | "createDesign" | "exportDesign">, template: CreateTemplate, row: Pick<CreateRow, "headline" | "subHeadline" | "fields" | "date" | "media" | "roundup">, format: CreateFormat, slides: readonly RoundupSlide[] = []) {
  const templateId = template.templates[format]!
  const dataset = await deps.templateFields(templateId)
  const { text, unfilled } = designText(template, row, dataset)
  if (unfilled.length) throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no place for: ${unfilled.join(", ")}`])
  const mediaField = template.media[format]
  if (mediaField && dataset[mediaField] !== "image") throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no media field "${mediaField}"`])
  const media = row.media && mediaField ? row.media : null
  const inputHash = designInputHash({ templateId, text, media, slides })
  const make = async (requestId: string, title: string) => {
    const design = await deps.createDesign({
      requestId, templateId, title, text,
      ...(media?.kind === "image" ? { image: { field: mediaField!, url: media.url, name: media.name } } : {}),
      ...(media?.kind === "video" ? { video: { field: mediaField!, url: media.url, name: media.name, bytes: media.bytes ?? 0 } } : {}),
    }).catch((err: unknown) => { throw media ? brokenFrameError(err, format, { kind: media.kind, field: mediaField! }) : err })
    const asVideo = media?.kind === "video" || format === "reels"
    const urls = asVideo ? await deps.exportDesign(design.designId, "mp4") : design.previewUrls.length ? design.previewUrls : await deps.exportDesign(design.designId, "jpg")
    if (!urls.length) throw new CreateRowError([`Canva returned no export for the ${FORMAT_LABEL[format]} design`], 502)
    return { design, urls, asVideo }
  }
  return { inputHash, hasMedia: !!mediaField, make }
}

/**
 * A fill with media that Canva refused (autofill_error) after the dataset check passed: Canva's dataset can still list a
 * photo frame the template no longer has (2026-10-29, MilCityUSA DT101 feed: the frame became the page background). The
 * row says so, on top of failedJobReason's reason, and keeps Canva's code and detail for the route's log.
 */
export function brokenFrameError(err: unknown, format: CreateFormat, media: { kind: "image" | "video"; field: string }): unknown {
  if (!(err instanceof CanvaError) || err.code !== "autofill_error") return err
  // A video row keeps failedJobReason's own advice (the frame may not take a video); a photo row has no use for it.
  const first = media.kind === "video" ? err.message : `Canva could not fill the ${FORMAT_LABEL[format]} template with this row's photo (autofill_error)`
  return new CanvaError(`${first}. The ${FORMAT_LABEL[format]} template's photo frame "${media.field}" may be broken in Canva; tell the coordinator, who can test it from the brand's page (Template check, Test fill)`, err.code, err.detail)
}

export interface ReplacedPost { format: CreateFormat; postId: string; designId: string; reused: boolean; holds: string[] }

/**
 * Replace media (Step 3 part 4): every variation of a Create row that a template made gets its template filled again
 * with the same card text (and the same printed date) and the new photo or video, exported, and put on the same post.
 * The caption, post date and platforms stay as they are; the posts stay in Review. A variation attached by link
 * (One-off) has no template to re-fill and is left as it is. Refused, with nothing changed, if any of them is already
 * out or publishing. Runs inside withProfile(), under the row's claim, like the Run job.
 *
 * Never a split row: every design is filled and exported in Canva first (a failure there changes no post); then every
 * size about to change that is approved is sent back to Review, approval withdrawn, before any file is replaced; only
 * then are the new files put on the posts (the guarded update voids what's left of an approval). A failure while
 * attaching can leave one size with old files, but never one still approved and publishable beside a changed one.
 */
export async function replaceRowMedia(deps: CreateRunDeps, rowId: string, text: CreateText, media: NonNullable<CreateRow["media"]>, actor: { email: string; name: string }): Promise<{ posts: ReplacedPost[]; profileVersionId: string }> {
  const { versionId } = activeProfile()
  const template = createTemplates(activeProfile().profile).find(t => t.kind === text.kind)
  if (!template) throw new CreateRowError([`This brand's profile no longer has the template this row was made with (${text.kind})`])
  if (!text.fields.date?.trim()) throw new CreateRowError(["The card's printed date isn't known for this row; run it again from Create"])
  const found = await Promise.all((["feed", "reels"] as const).map(async format => ({ format, post: adoptablePost(await deps.findByRequestId(createRequestId(rowId, format))) })))
  const made = found.filter((x): x is { format: CreateFormat; post: ContentPost } => !!x.post && x.post.create_row_id === rowId)
  if (!made.length) throw new CreateRowError(["Nothing in this row was made from a template; use One-off to attach a finished design"], 409)
  for (const { format, post } of made) if (frozen(post)) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post is already out or publishing; its media can't change`], 409)
  for (const { format, post } of made) if (post.intake?.metaBrand && post.intake.metaBrand !== BRAND.posts.metaBrand) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post belongs to another brand`], 409)
  // A photo goes to Instagram and Facebook at 4:5 only (Step 3 part 5): a 9:16 size that goes there needs a video.
  const shape = mediaShapeOf(media)
  if (template.roundup && shape === "video") throw new CreateRowError([`${template.label} is a carousel of photos; its cover takes a photo, not a video`])
  for (const { format, post } of made) {
    const off = (post.social_platforms ?? []).filter(x => !allowedPlatforms({ ...post, create_media: shape }).includes(x))
    if (off.length) throw new CreateRowError([`The ${FORMAT_LABEL[format]} size goes to ${off.map(x => SOCIAL_LABEL[x as CreateSocial]).join(" and ")}, which take a ${shape} at 4:5 only. Untick ${off.length > 1 ? "them" : "it"} on that size first, or replace with a video.`])
  }
  if (!await deps.claimRow(rowId, actor.email)) throw new CreateRowError(["This row is already running (another tab or click); wait for it to finish"], 409)
  try {
    // Every format is checked against its template before anything is made.
    const plans = []
    for (const { format, post } of made) {
      if (!template.templates[format]) throw new CreateRowError([`${template.label} has no ${FORMAT_LABEL[format]} template any more`])
      // The printed date is the card's own (text.fields.date), never rebuilt from a post date edited since.
      // A roundup's cards follow its cover as the run put them (roundup_slides), never chosen again here.
      const filled = await fillFormat(deps, template, { ...text, date: "", media }, format, post.roundup_slides ?? [])
      if (!filled.hasMedia) throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no photo or video frame`])
      plans.push({ format, post, filled })
    }
    const posts: ReplacedPost[] = []
    const changing = plans.filter(({ post, filled }) => !(post.create_input_hash === filled.inputHash && post.canva_design_id && post.assets.length))
    for (const { format, post } of plans) if (!changing.some(c => c.post.id === post.id)) posts.push({ format, postId: post.id, designId: post.canva_design_id!, reused: true, holds: [] })
    // 1. Every design, in Canva only.
    const ready = []
    for (const c of changing) ready.push({ ...c, ...await c.filled.make(`${createRequestId(rowId, c.format)}:${c.filled.inputHash}`, c.post.title) })
    // 2. Every approved size that will change goes back to Review first.
    for (const { post } of ready) if (isApproved(post)) await deps.sendBack(post.id, actor)
    // 3. The new files.
    for (const { format, post, filled, design, urls, asVideo } of ready) {
      const slides = post.roundup_slides ?? []
      const { items, canvaItems } = exportItems(format, urls, asVideo, slides)
      const attached = await deps.attachExports({ postId: post.id, items, canva: { designId: design.designId }, ...(slides.length ? { canvaItems } : {}), fileBase: exportFileBase(BRAND.id, post.date_to_post ?? "", template.roundup ? template.label : text.headline), rebind: true })
      await deps.updatePost(post.id, { create_input_hash: filled.inputHash, create_text: { ...text, fields: { ...text.fields } }, create_media: shape, canva_pages: [], profile_version_id: versionId })
      posts.push({ format, postId: post.id, designId: design.designId, reused: false, holds: [...attached.holds, ...shortExportHolds(format, media, attached.assets), ...(design.folderProblem ? [design.folderProblem] : [])] })
    }
    return { posts, profileVersionId: versionId }
  } finally { await deps.releaseRow(rowId).catch(err => console.error("[create-run] release failed:", rowId, err)) }
}

/** Production wiring: the publisher connector's Canva fill, export staging and post lookup (as run.ts uses them). */
export async function createRunDeps(): Promise<CreateRunDeps> {
  const [{ ownedMetaConnectorDeps, canvaDeps }, crm, { attachExports }, { exportDesignMp4, CanvaError }] = await Promise.all([
    import("@/lib/owned-meta-execution"), import("@/lib/firestore-crm"), import("@/lib/owned-meta-intake"), import("@/lib/canva-export"),
  ])
  const tools = await ownedMetaConnectorDeps()
  return {
    templateFields: id => tools.canvaFields(id),
    createDesign: async input => (await tools.canvaCreate(input)).design,
    exportDesign: async (designId, as) => {
      if (as === "jpg") return tools.canvaExport(designId)
      const { deps } = await canvaDeps()
      if (!deps) throw new CanvaError("Canva integration is not configured")
      return exportDesignMp4(deps, { designId })
    },
    findByRequestId: id => tools.intake.findByRequestId(id),
    createPost: post => crm.createContentPost(post),
    updatePost: (id, updates) => crm.updateContentPost(id, updates),
    attachExports: input => attachExports(tools.intake, { ...input, randomId: tools.randomId }),
    roundupStories: async () => (await (await import("./roundup")).liveRoundupChoices()).stories,
    claimRow: (rowId, by) => crm.claimCreateRun(rowId, by, Date.now()),
    releaseRow: rowId => crm.releaseCreateRun(rowId),
    sendBack: (postId, actor) => crm.sendBackToReview(postId, actor, "Media replaced in the drawer"),
    now: () => new Date().toISOString(),
  }
}

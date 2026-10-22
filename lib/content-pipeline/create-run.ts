import { BRAND, activeProfile } from "./brand"
import { SERIES, checkFields, normalizeFields } from "./series"
import { contentPropertyOf } from "./properties"
import { pipelineMarked, adoptablePost, PIPELINE_KEY_PREFIX } from "./ownership"
import { FORMAT_LABEL, createTemplates, designText, exportFileBase, formatsOf, rowProblems, type CreateFormat, type CreateRow, type CreateTemplate } from "./create-table"
import { frozen } from "./row-approval"
import { createHash } from "node:crypto"
import type { ContentPost, CreateText } from "@/components/crm/types"
import { canvaEditUrl, type CreateInput, type CreatedDesign } from "../canva-create"

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
  /** `rebind`: the post takes a new design in place of its old one (a re-run after the row changed). */
  attachExports(input: { postId: string; items: { url: string; label: string }[]; canva: { designId: string }; fileBase: string; rebind?: boolean }): Promise<{ holds: string[] }>
  /**
   * Claims the row for one run, atomically (a Firestore transaction): false while another run of it holds an unexpired
   * lease. Two tabs or a double click can't then fill two designs and stage two Review posts, since the Canva ledger
   * and the post lookup are read-then-write.
   */
  claimRow(rowId: string, by: string): Promise<boolean>
  releaseRow(rowId: string): Promise<void>
  now(): string
}
export interface CreatedPost { format: CreateFormat; postId: string; designId: string; editUrl: string; previewUrl?: string; holds: string[]; reused: boolean }
export class CreateRowError extends Error {
  constructor(readonly problems: string[], readonly status: 400 | 409 | 502 = 400) { super(problems.join("; ")) }
}

export const createRequestId = (rowId: string, format: CreateFormat) => `${PIPELINE_KEY_PREFIX}create:${rowId}:${format}`

/** What a design is made from: its template, card text and media. A change makes a new design. */
export function designInputHash(input: { templateId: string; text: Record<string, string>; media?: { kind: string; url: string; bytes?: number } | null }): string {
  const text = Object.fromEntries(Object.entries(input.text).sort(([a], [b]) => a.localeCompare(b)))
  return createHash("sha256").update(JSON.stringify({ t: input.templateId, text, m: input.media ? { k: input.media.kind, u: input.media.url, b: input.media.bytes ?? 0 } : null })).digest("hex").slice(0, 16)
}

/** The row checked against the brand's published profile: the table's own checks, then the template's field limits. */
export function serverRowProblems(row: CreateRow): { template?: CreateTemplate; problems: string[] } {
  const template = createTemplates(activeProfile().profile).find(t => t.kind === row.kind)
  const problems = rowProblems(row, template)
  if (!template || problems.length) return { template, problems }
  const series = SERIES[template.series]
  const values: Record<string, string> = {}
  for (const f of template.fields) values[f.name] = f.role === "headline" ? row.headline : f.role === "subHeadline" ? row.subHeadline : row.fields[f.name] ?? ""
  // The server fills the rest (dates, labels); the person's text is checked as the card will set it (uppercase, lines).
  const written = Object.fromEntries(Object.entries(normalizeFields(series, values)).filter(([k]) => template.fields.some(f => f.name === k)))
  const own = { ...series, fields: series.fields.filter(f => template.fields.some(x => x.name === f.name)) }
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
  for (const { format, platforms } of formatsOf(row.platforms)) {
    const postKey = createRequestId(row.id, format)
    const existing = adoptablePost(await deps.findByRequestId(postKey))
    const filled = await fillFormat(deps, template, row, format)
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
    const title = `${BRAND.shortName} ${template.label} — ${row.headline.replace(/\s+/g, " ").trim()}`.slice(0, 200)
    const { design, urls, asVideo } = await filled.make(`${postKey}:${inputHash}`, title)
    const now = deps.now()
    const notes = [`Made in the Create table (${template.label}, ${FORMAT_LABEL[format]}).`, row.referenceLink ? `Reference: ${row.referenceLink}` : "", row.notes.trim() ? `Notes: ${row.notes.trim()}` : ""].filter(Boolean).join("\n").slice(0, 4000)
    const post = existing
      // A re-run after the row changed: the post takes the row's current text with the new design.
      ? await deps.updatePost(existing.id, { title, notes, social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId })
      : await deps.createPost(pipelineMarked({
        user: actor.name || actor.email, date_created: now.slice(0, 10), platform: contentPropertyOf(BRAND.id), status: "needs_approval", title, notes,
        social_copy: row.caption.trim(), links: row.referenceLink ? [row.referenceLink] : [], assets: [], tags: BRAND.posts.tag,
        social_platforms: platforms, date_to_post: row.date, profile_version_id: versionId,
        ...(row.copyVersionId && row.copyVersionId !== versionId ? { copy_profile_version_id: row.copyVersionId } : {}),
        create_row_id: row.id, create_format: format,
        intake: { requestId: postKey, metaBrand: BRAND.posts.metaBrand, requestedBy: actor.email, at: now },
      } as Omit<ContentPost, "id" | "created_at" | "updated_at">))
    const items = asVideo ? [{ url: urls[0], label: `${format}-video` }] : urls.map((url, n) => ({ url, label: `${format}-page-${n + 1}` }))
    const attached = await deps.attachExports({ postId: post.id, items, canva: { designId: design.designId }, fileBase: exportFileBase(BRAND.id, row.date, row.headline), ...(existing ? { rebind: true } : {}) })
    await deps.updatePost(post.id, { create_input_hash: inputHash, create_text: createTextOf(row) })
    posts.push({ format, postId: post.id, designId: design.designId, editUrl: canvaEditUrl(design.designId), previewUrl: design.previewUrls[0], holds: [...attached.holds, ...(design.folderProblem ? [design.folderProblem] : [])], reused: false })
  }
  return posts
}

/** The row's card text and template, kept on each post so Replace media can re-fill the designs (Step 3 part 4). */
export const createTextOf = (row: Pick<CreateRow, "brand" | "kind" | "headline" | "subHeadline" | "fields">): CreateText =>
  ({ brand: row.brand, kind: row.kind, headline: row.headline, subHeadline: row.subHeadline, fields: { ...row.fields } })

/**
 * One format's design input, checked against its template; make() fills the template in Canva and exports it. The
 * Run job and Replace media share it, so both hash a design the same way (designInputHash) and an approval is voided
 * by the same new files.
 */
async function fillFormat(deps: Pick<CreateRunDeps, "templateFields" | "createDesign" | "exportDesign">, template: CreateTemplate, row: Pick<CreateRow, "headline" | "subHeadline" | "fields" | "date" | "media">, format: CreateFormat) {
  const templateId = template.templates[format]!
  const dataset = await deps.templateFields(templateId)
  const { text, unfilled } = designText(template, row, dataset)
  if (unfilled.length) throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no place for: ${unfilled.join(", ")}`])
  const mediaField = template.media[format]
  if (mediaField && dataset[mediaField] !== "image") throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no media field "${mediaField}"`])
  const media = row.media && mediaField ? row.media : null
  const inputHash = designInputHash({ templateId, text, media })
  const make = async (requestId: string, title: string) => {
    const design = await deps.createDesign({
      requestId, templateId, title, text,
      ...(media?.kind === "image" ? { image: { field: mediaField!, url: media.url, name: media.name } } : {}),
      ...(media?.kind === "video" ? { video: { field: mediaField!, url: media.url, name: media.name, bytes: media.bytes ?? 0 } } : {}),
    })
    const asVideo = media?.kind === "video" || format === "reels"
    const urls = asVideo ? await deps.exportDesign(design.designId, "mp4") : design.previewUrls.length ? design.previewUrls : await deps.exportDesign(design.designId, "jpg")
    if (!urls.length) throw new CreateRowError([`Canva returned no export for the ${FORMAT_LABEL[format]} design`], 502)
    return { design, urls, asVideo }
  }
  return { inputHash, hasMedia: !!mediaField, make }
}

export interface ReplacedPost { format: CreateFormat; postId: string; designId: string; reused: boolean; holds: string[] }

/**
 * Replace media (Step 3 part 4): every variation of a Create row that a template made gets its template filled again
 * with the same card text and the new photo or video, exported, and put on the same post. The caption, date and
 * platforms stay as they are; the posts stay in Review, and the new files void any approval (the guarded update resets
 * it, as a re-run after the row changed does). A variation attached by link (One-off) has no template to re-fill and
 * is left as it is. Refused, with nothing changed, if any of them is already out or publishing. Runs inside
 * withProfile(), under the row's claim, like the Run job.
 */
export async function replaceRowMedia(deps: CreateRunDeps, rowId: string, text: CreateText, media: NonNullable<CreateRow["media"]>, actor: { email: string }): Promise<{ posts: ReplacedPost[]; profileVersionId: string }> {
  const { versionId } = activeProfile()
  const template = createTemplates(activeProfile().profile).find(t => t.kind === text.kind)
  if (!template) throw new CreateRowError([`This brand's profile no longer has the template this row was made with (${text.kind})`])
  const found = await Promise.all((["feed", "reels"] as const).map(async format => ({ format, post: adoptablePost(await deps.findByRequestId(createRequestId(rowId, format))) })))
  const made = found.filter((x): x is { format: CreateFormat; post: ContentPost } => !!x.post && x.post.create_row_id === rowId)
  if (!made.length) throw new CreateRowError(["Nothing in this row was made from a template; use One-off to attach a finished design"], 409)
  for (const { format, post } of made) if (frozen(post)) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post is already out or publishing; its media can't change`], 409)
  for (const { format, post } of made) if (post.intake?.metaBrand && post.intake.metaBrand !== BRAND.posts.metaBrand) throw new CreateRowError([`The ${FORMAT_LABEL[format]} post belongs to another brand`], 409)
  if (!await deps.claimRow(rowId, actor.email)) throw new CreateRowError(["This row is already running (another tab or click); wait for it to finish"], 409)
  try {
    // Every format is checked against its template before anything is made.
    const plans = []
    for (const { format, post } of made) {
      if (!template.templates[format]) throw new CreateRowError([`${template.label} has no ${FORMAT_LABEL[format]} template any more`])
      const filled = await fillFormat(deps, template, { ...text, date: post.date_to_post ?? "", media }, format)
      if (!filled.hasMedia) throw new CreateRowError([`The ${FORMAT_LABEL[format]} template has no photo or video frame`])
      plans.push({ format, post, filled })
    }
    const posts: ReplacedPost[] = []
    for (const { format, post, filled } of plans) {
      if (post.create_input_hash === filled.inputHash && post.canva_design_id && post.assets.length) { posts.push({ format, postId: post.id, designId: post.canva_design_id, reused: true, holds: [] }); continue }
      const { design, urls, asVideo } = await filled.make(`${createRequestId(rowId, format)}:${filled.inputHash}`, post.title)
      const items = asVideo ? [{ url: urls[0], label: `${format}-video` }] : urls.map((url, n) => ({ url, label: `${format}-page-${n + 1}` }))
      const attached = await deps.attachExports({ postId: post.id, items, canva: { designId: design.designId }, fileBase: exportFileBase(BRAND.id, post.date_to_post ?? "", text.headline), rebind: true })
      await deps.updatePost(post.id, { create_input_hash: filled.inputHash, create_text: createTextOf(text), canva_pages: [], profile_version_id: versionId })
      posts.push({ format, postId: post.id, designId: design.designId, reused: false, holds: [...attached.holds, ...(design.folderProblem ? [design.folderProblem] : [])] })
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
    claimRow: (rowId, by) => crm.claimCreateRun(rowId, by, Date.now()),
    releaseRow: rowId => crm.releaseCreateRun(rowId),
    now: () => new Date().toISOString(),
  }
}

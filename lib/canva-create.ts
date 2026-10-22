import { createHash } from "node:crypto"
import { canvaAccessToken, CanvaError, exportDesignJpg, CANVA_API, type CanvaDeps } from "./canva-export"

/**
 * Canva Connect API: create a working design from an approved Brand Template (autofill) for the shared Slack app's
 * MCU skill. Masters are never targeted: autofill from a brand template always creates a NEW design in the
 * connected account's root folder. Optional image: the caller's public URL is fetched here (SSRF-guarded by the
 * injected fetcher), checked by file signature, uploaded to Canva as an asset, then bound to the template's image
 * field. An optional crop box (fractions of the photo) is applied before the upload: Canva's fill only centres a photo,
 * so the caller zooms to keep the subject clear of the card's text. A preview JPG export follows so the reviewer sees
 * the real artwork.
 *
 * Contract (canva.dev, read 2026-10-16):
 *  - GET  /brand-templates/{id}/dataset            scope brandtemplate:content:read
 *  - POST /asset-uploads (octet-stream, Asset-Upload-Metadata {name_base64}); GET /asset-uploads/{job}  asset:write / asset:read
 *  - POST /autofills {brand_template_id, title, data}; GET /autofills/{job}   design:content:write / design:meta:read
 *    Available on Canva Pro, Teams and Enterprise; the new design's edit/view urls last 30 days.
 *  - GET  /folders/root/items?item_types=folder; POST /folders/move {to_folder_id, item_id}   folder:read / folder:write
 *    (read 2026-10-21). `root` is the top of the connected user's Projects; the move answers 204 with no body.
 * Idempotent per requestId through the injected ledger, so a retried request returns the design it already made.
 *
 * The team folder (founder, 2026-10-20: Canva Business): every new design is moved into the shared "434 Working
 * Designs" folder right after autofill, so the team opens it with their own Canva logins. The folder is found by name
 * once and its id kept (deps.folder); a design that can't be moved is still made, and says why (folderProblem).
 */
export interface CreateLedger {
  get(requestId: string): Promise<CreatedDesign | null>
  put(requestId: string, value: CreatedDesign): Promise<void>
}
export interface CreateDeps {
  canva: CanvaDeps
  /** A video's bytes as a stream, for one larger than Canva's URL upload takes (SSRF-guarded like fetchImage). */
  streamVideo?(url: string): Promise<{ body: ReadableStream<Uint8Array>; bytes: number }>
  ledger: CreateLedger
  /** SSRF-guarded public https fetch; returns bytes. */
  fetchImage(url: string): Promise<Uint8Array>
  /** Crops image bytes to a fractional box (lib/image-crop.ts); required only when a request carries a crop. */
  cropImage?(bytes: Uint8Array, box: CropBox): Promise<Uint8Array>
  /** Brand templates the service may fill. Anything else is refused. */
  allowedTemplates: ReadonlySet<string>
  /** The shared team folder new designs are moved into, when configured. */
  folder?: WorkingFolder
}
/** The team folder by name, with its id kept once found (never hard-coded). */
export interface WorkingFolder {
  name: string
  get(): Promise<string | null>
  put(id: string | null): Promise<void>
}
export interface CreateInput {
  requestId: string
  templateId: string
  title: string
  text: Record<string, string>
  image?: { field: string; url: string; name: string; crop?: CropBox }
  /**
   * A video placed in the template's image field (Canva autofill takes {type: "video"} there). Uploaded from its
   * public https URL: Canva fetches it itself up to 100 MB; a larger file is streamed through (see uploadVideo).
   */
  video?: { field: string; url: string; name: string; bytes: number }
}
/** A crop as fractions (0–1) of the upright photo, from its top-left corner. */
export interface CropBox { x: number; y: number; width: number; height: number }
export interface CreatedDesign {
  designId: string
  title: string
  editUrl: string
  viewUrl: string
  templateId: string
  fields: string[]
  image?: { field: string; url: string; sha256: string; bytes: number; assetId: string; crop?: CropBox }
  video?: { field: string; url: string; bytes: number; assetId: string }
  previewUrls: string[]
  createdAt: string
  /** The team folder the design was moved into, or why it wasn't (the design is still made). */
  folderId?: string
  folderProblem?: string
}

/**
 * A design's permanent links. The API's edit_url and view_url expire after 30 days; these don't, and open for anyone the
 * design (or its folder) is shared with.
 */
export const canvaEditUrl = (designId: string) => `https://www.canva.com/design/${encodeURIComponent(designId)}/edit`
export const canvaViewUrl = (designId: string) => `https://www.canva.com/design/${encodeURIComponent(designId)}/view`

const ID = /^[A-Za-z0-9_-]{6,64}$/
const FIELD = /^[a-z][a-z0-9_]{0,63}$/
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
/** Canva's limits (canva.dev, read 2026-10-19): a video asset under 500 MB; one uploaded from a URL at most 100 MB. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024
export const MAX_URL_VIDEO_BYTES = 100 * 1024 * 1024

function kind(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg"
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  return null
}

export function validCrop(c: CropBox): boolean {
  const n = [c.x, c.y, c.width, c.height]
  return n.every(v => Number.isFinite(v) && v >= 0 && v <= 1) && c.width >= 0.1 && c.height >= 0.1 && c.x + c.width <= 1.0001 && c.y + c.height <= 1.0001
}

async function api(deps: CanvaDeps, token: string, path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await deps.fetcher(new URL(`${CANVA_API}${path}`), { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body && !(init.headers as Record<string, string> | undefined)?.["content-type"] ? { "content-type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) }, redirect: "error", cache: "no-store", signal: init.signal ?? AbortSignal.timeout(30_000) })
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  // Never surface Canva's message: only its short code or the HTTP status.
  if (response.status === 401 || response.status === 403) throw new CanvaError("Canva refused this action; reconnect Canva with the design-creation permissions", (data.code as string) || `http_${response.status}`)
  if (!response.ok) throw new CanvaError("Canva request failed", (data.code as string) || `http_${response.status}`)
  return data
}

type Job = { id?: string; status?: string; error?: { code?: string }; asset?: { id?: string }; result?: { design?: { id?: string; title?: string; urls?: { edit_url?: string; view_url?: string } } } }
async function poll(deps: CanvaDeps, token: string, path: string, job: Job, limits: { polls: number; intervalMs: number }): Promise<Job> {
  for (let i = 0; job.status === "in_progress" && i < limits.polls; i++) {
    await deps.sleep(limits.intervalMs)
    job = (await api(deps, token, `${path}/${encodeURIComponent(job.id!)}`)).job as Job
  }
  if (job.status === "failed") throw new CanvaError("Canva could not complete the job", job.error?.code)
  if (job.status !== "success") throw new CanvaError("Canva is still working; try again shortly", "timeout")
  return job
}

/** The template's fillable fields (name → type). An empty map means it cannot be autofilled. */
export async function templateFields(deps: Pick<CreateDeps, "canva" | "allowedTemplates">, templateId: string): Promise<Record<string, string>> {
  if (!ID.test(templateId) || !deps.allowedTemplates.has(templateId)) throw new CanvaError("This brand template is not on the allowed list", "template_not_allowed")
  const token = await canvaAccessToken(deps.canva)
  const data = await api(deps.canva, token, `/brand-templates/${encodeURIComponent(templateId)}/dataset`)
  const dataset = (data.dataset ?? {}) as Record<string, { type?: string }>
  return Object.fromEntries(Object.entries(dataset).map(([k, v]) => [k, String(v?.type ?? "unknown")]))
}

export async function createFromTemplate(deps: CreateDeps, input: CreateInput, limits = { polls: 30, intervalMs: 2_000 }): Promise<{ design: CreatedDesign; reused: boolean }> {
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(input.requestId)) throw new CanvaError("A stable requestId (8–128 characters) is required", "request_id")
  const done = await deps.ledger.get(input.requestId)
  if (done) return { design: done, reused: true }
  const title = input.title.trim()
  if (!title || title.length > 255) throw new CanvaError("Title required (at most 255 characters)", "title")
  const entries = Object.entries(input.text)
  if (!entries.length || entries.length > 30 || entries.some(([k, v]) => !FIELD.test(k) || typeof v !== "string" || v.length > 2000)) throw new CanvaError("Text fields must be named template fields with at most 2,000 characters each", "fields")
  const fields = await templateFields(deps, input.templateId)
  // Only fields the template actually has, with the right type: a misspelt key fails here, not silently in Canva.
  const unknown = entries.filter(([k]) => fields[k] !== "text").map(([k]) => k)
  if (input.image && fields[input.image.field] !== "image") unknown.push(input.image.field)
  if (input.video && fields[input.video.field] !== "image") unknown.push(input.video.field)
  if (input.image && input.video) throw new CanvaError("A design takes a photo or a video in its media field, not both", "media")
  if (unknown.length) throw new CanvaError(`The template has no matching field for: ${unknown.join(", ")}`, "unknown_field")

  const token = await canvaAccessToken(deps.canva)
  let image: CreatedDesign["image"]
  if (input.image) {
    if (!input.image.url.startsWith("https://")) throw new CanvaError("Image must be a public https URL", "image_url")
    const crop = input.image.crop
    if (crop && !validCrop(crop)) throw new CanvaError("Crop must be a box inside the photo, at least a tenth of each side", "image_crop")
    if (crop && !deps.cropImage) throw new CanvaError("Cropping is not available here", "image_crop")
    const fetched = await deps.fetchImage(input.image.url)
    if (fetched.byteLength > MAX_IMAGE_BYTES) throw new CanvaError("Image exceeds 25 MB", "image_size")
    if (!kind(fetched)) throw new CanvaError("Image must be a JPEG or PNG file", "image_type")
    const bytes = crop ? await deps.cropImage!(fetched, crop) : fetched
    const name = (input.image.name.trim() || "MCU media").slice(0, 50)
    const started = await api(deps.canva, token, "/asset-uploads", { method: "POST", body: Buffer.from(bytes), headers: { "content-type": "application/octet-stream", "asset-upload-metadata": JSON.stringify({ name_base64: Buffer.from(name, "utf8").toString("base64") }) } })
    const job = await poll(deps.canva, token, "/asset-uploads", started.job as Job, limits)
    if (!job.asset?.id) throw new CanvaError("Canva did not return the uploaded asset", "asset")
    image = { field: input.image.field, url: input.image.url, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength, assetId: job.asset.id, ...(crop ? { crop } : {}) }
  }
  let video: CreatedDesign["video"]
  if (input.video) video = { field: input.video.field, url: input.video.url, bytes: input.video.bytes, assetId: await uploadVideo(deps, token, input.video, limits) }
  const data: Record<string, unknown> = Object.fromEntries(entries.map(([k, v]) => [k, { type: "text", text: v }]))
  if (image) data[image.field] = { type: "image", asset_id: image.assetId }
  if (video) data[video.field] = { type: "video", asset_id: video.assetId }
  const started = await api(deps.canva, token, "/autofills", { method: "POST", body: JSON.stringify({ brand_template_id: input.templateId, title, data }) })
  const job = await poll(deps.canva, token, "/autofills", started.job as Job, limits)
  const d = job.result?.design
  if (!d?.id || !ID.test(d.id)) throw new CanvaError("Canva did not return the new design", "design")
  const folder = deps.folder ? await moveToWorkingFolder(deps.canva, token, deps.folder, d.id).then(id => ({ folderId: id }), (err: unknown) => ({ folderProblem: `Not moved to the Canva folder "${deps.folder!.name}": ${err instanceof CanvaError ? err.message : "the move failed"}` })) : {}
  const previewUrls = await exportDesignJpg(deps.canva, { designId: d.id })
  const design: CreatedDesign = { designId: d.id, title: d.title || title, editUrl: canvaEditUrl(d.id), viewUrl: canvaViewUrl(d.id), templateId: input.templateId, fields: entries.map(([k]) => k), ...(image ? { image } : {}), ...(video ? { video } : {}), previewUrls, createdAt: new Date(deps.canva.nowMs()).toISOString(), ...folder }
  await deps.ledger.put(input.requestId, design)
  return { design, reused: false }
}

/** The team folder's id: the kept one, else found by exact name (case aside) among the folders at the top of Projects. */
async function findWorkingFolder(deps: CanvaDeps, token: string, folder: WorkingFolder): Promise<string> {
  const kept = await folder.get()
  if (kept) return kept
  const want = folder.name.trim().toLowerCase()
  let continuation = ""
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ item_types: "folder", limit: "100", ...(continuation ? { continuation } : {}) })
    const data = await api(deps, token, `/folders/root/items?${q}`)
    const items = (Array.isArray(data.items) ? data.items : []) as { type?: string; folder?: { id?: string; name?: string } }[]
    const hit = items.find(i => i.type === "folder" && i.folder?.id && ID.test(i.folder.id) && (i.folder.name ?? "").trim().toLowerCase() === want)
    if (hit) { await folder.put(hit.folder!.id!); return hit.folder!.id! }
    continuation = typeof data.continuation === "string" ? data.continuation : ""
    if (!continuation) break
  }
  throw new CanvaError(`no folder named "${folder.name}" in the connected Canva account's Projects`, "folder_not_found")
}

/** Moves a new design into the team folder. A kept id that no longer resolves is forgotten and the folder found again. */
export async function moveToWorkingFolder(deps: CanvaDeps, token: string, folder: WorkingFolder, designId: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = await findWorkingFolder(deps, token, folder)
    try {
      await api(deps, token, "/folders/move", { method: "POST", body: JSON.stringify({ to_folder_id: id, item_id: designId }) })
      return id
    } catch (err) {
      if (attempt === 0 && err instanceof CanvaError && err.code === "folder_not_found") { await folder.put(null); continue }
      throw err
    }
  }
  throw new CanvaError("the folder could not be found", "folder_not_found")
}

/**
 * A video as a Canva asset. Up to 100 MB Canva fetches it from its URL (POST /url-asset-uploads, a preview API: no
 * bytes pass through the function); a larger one, up to 500 MB, is streamed from its URL into POST /asset-uploads.
 */
async function uploadVideo(deps: CreateDeps, token: string, v: NonNullable<CreateInput["video"]>, limits: { polls: number; intervalMs: number }): Promise<string> {
  if (!v.url.startsWith("https://")) throw new CanvaError("Video must be a public https URL", "video_url")
  if (!Number.isSafeInteger(v.bytes) || v.bytes <= 0 || v.bytes > MAX_VIDEO_BYTES) throw new CanvaError("Video must be under 500 MB", "video_size")
  const name = (v.name.trim() || "Video").slice(0, 50)
  // A video takes longer than a photo for Canva to import: up to five minutes.
  const slow = { polls: Math.max(limits.polls, 150), intervalMs: limits.intervalMs }
  let job: Job
  if (v.bytes <= MAX_URL_VIDEO_BYTES) {
    const started = await api(deps.canva, token, "/url-asset-uploads", { method: "POST", body: JSON.stringify({ name, url: v.url }) })
    job = await poll(deps.canva, token, "/url-asset-uploads", started.job as Job, slow)
  } else {
    if (!deps.streamVideo) throw new CanvaError("Videos over 100 MB cannot be uploaded here", "video_size")
    const { body, bytes } = await deps.streamVideo(v.url)
    if (bytes > MAX_VIDEO_BYTES) throw new CanvaError("Video must be under 500 MB", "video_size")
    const started = await api(deps.canva, token, "/asset-uploads", { method: "POST", body, duplex: "half", signal: AbortSignal.timeout(600_000), headers: { "content-type": "application/octet-stream", "content-length": String(bytes), "asset-upload-metadata": JSON.stringify({ name_base64: Buffer.from(name, "utf8").toString("base64") }) } } as RequestInit)
    job = await poll(deps.canva, token, "/asset-uploads", started.job as Job, slow)
  }
  if (!job.asset?.id) throw new CanvaError("Canva did not return the uploaded video", "asset")
  return job.asset.id
}

/**
 * Brand templates the service may fill: every template in a brand's published profile (its template map), so the
 * list lives with the brand in the database, not in this public repository (plan v11 Step 2). Nothing outside it is
 * filled. Pass the published profiles, read fresh (lib/firestore-brand-profiles.ts publishedTemplateIds).
 */
export function profileTemplateIds(profiles: readonly { series: Record<string, { templates: { feed?: string; reels?: string } } | undefined> }[]): ReadonlySet<string> {
  return new Set(profiles.flatMap(p => Object.values(p.series).flatMap(s => [s?.templates.feed, s?.templates.reels])).filter((id): id is string => !!id && ID.test(id)))
}

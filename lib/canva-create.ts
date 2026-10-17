import { createHash } from "node:crypto"
import { canvaAccessToken, CanvaError, exportDesignJpg, CANVA_API, type CanvaDeps } from "./canva-export"

/**
 * Canva Connect API: create a working design from an approved Brand Template (autofill) for the shared Slack app's
 * MCU skill. Masters are never targeted: autofill from a brand template always creates a NEW design in the
 * connected account's root folder. Optional image: the caller's public URL is fetched here (SSRF-guarded by the
 * injected fetcher), checked by file signature, uploaded to Canva as an asset, then bound to the template's image
 * field. A preview JPG export follows so the reviewer sees the real artwork.
 *
 * Contract (canva.dev, read 2026-10-16):
 *  - GET  /brand-templates/{id}/dataset            scope brandtemplate:content:read
 *  - POST /asset-uploads (octet-stream, Asset-Upload-Metadata {name_base64}); GET /asset-uploads/{job}  asset:write / asset:read
 *  - POST /autofills {brand_template_id, title, data}; GET /autofills/{job}   design:content:write / design:meta:read
 *    Available on Canva Pro, Teams and Enterprise; the new design's edit/view urls last 30 days.
 * Idempotent per requestId through the injected ledger, so a retried request returns the design it already made.
 */
export interface CreateLedger {
  get(requestId: string): Promise<CreatedDesign | null>
  put(requestId: string, value: CreatedDesign): Promise<void>
}
export interface CreateDeps {
  canva: CanvaDeps
  ledger: CreateLedger
  /** SSRF-guarded public https fetch; returns bytes. */
  fetchImage(url: string): Promise<Uint8Array>
  /** Brand templates the service may fill. Anything else is refused. */
  allowedTemplates: ReadonlySet<string>
}
export interface CreateInput {
  requestId: string
  templateId: string
  title: string
  text: Record<string, string>
  image?: { field: string; url: string; name: string }
}
export interface CreatedDesign {
  designId: string
  title: string
  editUrl: string
  viewUrl: string
  templateId: string
  fields: string[]
  image?: { field: string; url: string; sha256: string; bytes: number; assetId: string }
  previewUrls: string[]
  createdAt: string
}

const ID = /^[A-Za-z0-9_-]{6,64}$/
const FIELD = /^[a-z][a-z0-9_]{0,63}$/
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024

function kind(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg"
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  return null
}

async function api(deps: CanvaDeps, token: string, path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await deps.fetcher(new URL(`${CANVA_API}${path}`), { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body && !(init.headers as Record<string, string> | undefined)?.["content-type"] ? { "content-type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) })
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
  if (unknown.length) throw new CanvaError(`The template has no matching field for: ${unknown.join(", ")}`, "unknown_field")

  const token = await canvaAccessToken(deps.canva)
  let image: CreatedDesign["image"]
  if (input.image) {
    if (!input.image.url.startsWith("https://")) throw new CanvaError("Image must be a public https URL", "image_url")
    const bytes = await deps.fetchImage(input.image.url)
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new CanvaError("Image exceeds 25 MB", "image_size")
    if (!kind(bytes)) throw new CanvaError("Image must be a JPEG or PNG file", "image_type")
    const name = (input.image.name.trim() || "MCU media").slice(0, 50)
    const started = await api(deps.canva, token, "/asset-uploads", { method: "POST", body: Buffer.from(bytes), headers: { "content-type": "application/octet-stream", "asset-upload-metadata": JSON.stringify({ name_base64: Buffer.from(name, "utf8").toString("base64") }) } })
    const job = await poll(deps.canva, token, "/asset-uploads", started.job as Job, limits)
    if (!job.asset?.id) throw new CanvaError("Canva did not return the uploaded asset", "asset")
    image = { field: input.image.field, url: input.image.url, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength, assetId: job.asset.id }
  }
  const data: Record<string, unknown> = Object.fromEntries(entries.map(([k, v]) => [k, { type: "text", text: v }]))
  if (image) data[image.field] = { type: "image", asset_id: image.assetId }
  const started = await api(deps.canva, token, "/autofills", { method: "POST", body: JSON.stringify({ brand_template_id: input.templateId, title, data }) })
  const job = await poll(deps.canva, token, "/autofills", started.job as Job, limits)
  const d = job.result?.design
  if (!d?.id || !ID.test(d.id)) throw new CanvaError("Canva did not return the new design", "design")
  const previewUrls = await exportDesignJpg(deps.canva, { designId: d.id })
  const design: CreatedDesign = { designId: d.id, title: d.title || title, editUrl: d.urls?.edit_url || "", viewUrl: d.urls?.view_url || "", templateId: input.templateId, fields: entries.map(([k]) => k), ...(image ? { image } : {}), previewUrls, createdAt: new Date(deps.canva.nowMs()).toISOString() }
  await deps.ledger.put(input.requestId, design)
  return { design, reused: false }
}

/**
 * Brand templates the service may fill: the published MilCityUSA templates (feed / Reels per series), as named by
 * the founder on 2026-10-16. Series rules and field choice live in the Slack app; this list only bounds what the
 * connected account can be asked to fill.
 */
export const MCU_BRAND_TEMPLATES: ReadonlySet<string> = new Set([
  "EAHXWo1LiF8", "EAHXZN4kp3Y", // News
  "EAHXZAbAA8s", "EAHXZAPPFLQ", // Breaking News
  "EAHYOAJhC_8", // Defense Tech 101, benefit-led feed (founder-approved design, published 2026-10-16)
  "EAHXZIadVzM", "EAHXZAunvYI", // Defense Tech 101, original MAKER/DOMAIN/STATUS masters (retired for new posts)
  "EAHXZPgjqSY", "EAHXZJnI-Nc", // ICYMI cover
  "EAHXZJnAT0o", "EAHXZMFmSh0", // ICYMI story
  "EAHXZOYmzQ8", "EAHXZHGriWI", // Follow-on graphic
  "EAHXZEmHgsE", "EAHXZHixcNk", // Follow-on text
  "EAHXZNY2y7A", "EAHXZeK2aFE", // Tentpole talent
  "EAHXZShXbag", "EAHXZQVQ34s", // Tentpole ceremonial
])

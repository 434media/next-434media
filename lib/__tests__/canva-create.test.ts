/** Offline. Brand-template autofill into a new working design (lib/canva-create.ts). No network, no Firestore. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { seal, type CanvaDeps, type CanvaTokenRecord, type CanvaTokenStore } from "../canva-export"
import { createFromTemplate, templateFields, MCU_BRAND_TEMPLATES, type CreateDeps, type CreatedDesign } from "../canva-create"
import { TOOL_SCOPE } from "../owned-meta-connector"
import { SERVICE_TOOL_SCOPE } from "../owned-meta-service"

const KEY = Buffer.alloc(32, 7), DT101 = "EAHXZIadVzM"
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])
const DATASET = { dataset: { headline: { type: "text" }, deck: { type: "text" }, maker: { type: "text" }, media: { type: "image" } } }
class Store implements CanvaTokenStore {
  record: CanvaTokenRecord | null = { version: 1, sealed: seal(KEY, { accessToken: "at", refreshToken: "rt", expiresAt: 9e15 }), connectedBy: "m", connectedAt: "t" }
  async read() { return this.record }
  async write() { return true }
}
function setup(handler: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [], ledger = new Map<string, CreatedDesign>()
  const canva: CanvaDeps = { client: { clientId: "c", clientSecret: "s", redirectUri: "https://x", tokenKey: KEY }, store: new Store(), fetcher: (async (u: URL, init: RequestInit) => { calls.push({ url: u.toString(), init }); return handler(u.toString(), init) }) as typeof fetch, nowMs: () => 1_000, sleep: async () => {} }
  const fetched: string[] = []
  const deps: CreateDeps = { canva, ledger: { get: async k => ledger.get(k) ?? null, put: async (k, v) => { ledger.set(k, v) } }, allowedTemplates: MCU_BRAND_TEMPLATES, fetchImage: async url => { fetched.push(url); return JPEG } }
  return { deps, calls, ledger, fetched }
}
function happy(url: string, init: RequestInit): Response {
  if (url.endsWith(`/brand-templates/${DT101}/dataset`)) return Response.json(DATASET)
  if (url.endsWith("/asset-uploads") && init.method === "POST") return Response.json({ job: { id: "up1", status: "in_progress" } })
  if (url.endsWith("/asset-uploads/up1")) return Response.json({ job: { id: "up1", status: "success", asset: { id: "MAasset1" } } })
  if (url.endsWith("/autofills") && init.method === "POST") return Response.json({ job: { id: "af1", status: "in_progress" } })
  if (url.endsWith("/autofills/af1")) return Response.json({ job: { id: "af1", status: "success", result: { type: "create_design", design: { id: "DAHnew0001", title: "T", urls: { edit_url: "https://www.canva.com/d/e", view_url: "https://www.canva.com/d/v" } } } } })
  if (url.endsWith("/exports") && init.method === "POST") return Response.json({ job: { id: "ex1", status: "success", urls: ["https://export.canva.com/p1.jpg"] } })
  return Response.json({ code: "unexpected" }, { status: 500 })
}
const INPUT = { requestId: "slack:Ev1:mcu:item1:v1", templateId: DT101, title: "MCU DT101 test", text: { headline: "HIMARS", deck: "Fires guided rockets.", maker: "Lockheed Martin" }, image: { field: "media", url: "https://upload.wikimedia.org/x.jpg", name: "HIMARS" } }

test("creates a new design from the template: uploads the image bytes, fills only named fields, exports a preview", async () => {
  const s = setup(happy)
  const { design, reused } = await createFromTemplate(s.deps, INPUT, { polls: 3, intervalMs: 1 })
  assert.equal(reused, false); assert.equal(design.designId, "DAHnew0001"); assert.deepEqual(design.previewUrls, ["https://export.canva.com/p1.jpg"])
  assert.equal(design.image?.assetId, "MAasset1"); assert.equal(design.image?.bytes, JPEG.byteLength); assert.match(design.image!.sha256, /^[a-f0-9]{64}$/)
  const upload = s.calls.find(c => c.url.endsWith("/asset-uploads") && c.init.method === "POST")!
  const h = upload.init.headers as Record<string, string>
  assert.equal(h["content-type"], "application/octet-stream")
  assert.equal(Buffer.from(JSON.parse(h["asset-upload-metadata"]).name_base64, "base64").toString(), "HIMARS")
  const fill = JSON.parse(String(s.calls.find(c => c.url.endsWith("/autofills") && c.init.method === "POST")!.init.body))
  assert.equal(fill.brand_template_id, DT101)
  assert.deepEqual(fill.data, { headline: { type: "text", text: "HIMARS" }, deck: { type: "text", text: "Fires guided rockets." }, maker: { type: "text", text: "Lockheed Martin" }, media: { type: "image", asset_id: "MAasset1" } })
  assert.ok(s.calls.every(c => (c.init.headers as Record<string, string>).authorization === "Bearer at"))
})

test("a retried request returns the design it already created and calls Canva no further", async () => {
  const s = setup(happy)
  await createFromTemplate(s.deps, INPUT, { polls: 3, intervalMs: 1 })
  const before = s.calls.length
  const again = await createFromTemplate(s.deps, INPUT, { polls: 3, intervalMs: 1 })
  assert.equal(again.reused, true); assert.equal(s.calls.length, before); assert.equal(s.fetched.length, 1)
})

test("refuses a template outside the MCU list before touching Canva", async () => {
  const s = setup(happy)
  await assert.rejects(createFromTemplate(s.deps, { ...INPUT, templateId: "EAHotherXXX" }), /not on the allowed list/)
  await assert.rejects(templateFields(s.deps, "EAHotherXXX"), /not on the allowed list/)
  assert.equal(s.calls.length, 0)
})

test("a field the template does not have stops the run before any upload or autofill", async () => {
  const s = setup(happy)
  await assert.rejects(createFromTemplate(s.deps, { ...INPUT, text: { ...INPUT.text, domain: "Land" } }), /no matching field for: domain/)
  await assert.rejects(createFromTemplate(s.deps, { ...INPUT, image: { ...INPUT.image, field: "headline" } }), /no matching field for: headline/)
  assert.ok(!s.calls.some(c => c.url.includes("/asset-uploads") || c.url.includes("/autofills"))); assert.equal(s.fetched.length, 0)
})

test("a non-image file is refused; Canva's refusal becomes a reconnect message with its code only", async () => {
  const s = setup(happy)
  s.deps.fetchImage = async () => new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c])
  await assert.rejects(createFromTemplate(s.deps, INPUT), /JPEG or PNG/)
  const denied = setup((url, init) => url.endsWith("/autofills") && init.method === "POST" ? Response.json({ code: "missing_scope", message: "vendor text" }, { status: 403 }) : happy(url, init))
  await assert.rejects(createFromTemplate(denied.deps, { ...INPUT, image: undefined }), (e: Error & { code?: string }) => /reconnect Canva/.test(e.message) && e.code === "missing_scope" && !e.message.includes("vendor text"))
  assert.equal(denied.ledger.size, 0)
})

test("the design-creation tools serve only the Slack app's service, never the ChatGPT connector", () => {
  for (const t of ["canva_template_fields", "canva_create_design", "canva_preview"] as const) { assert.equal(TOOL_SCOPE[t], undefined); assert.equal(SERVICE_TOOL_SCOPE[t], "content:prepare") }
})

test("a crop box zooms the photo before the upload: the cropped bytes are what Canva receives, and the box is recorded", async () => {
  const s = setup(happy), CROPPED = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 0xff, 0xd9]), boxes: unknown[] = []
  s.deps.cropImage = async (bytes, box) => { assert.deepEqual(bytes, JPEG); boxes.push(box); return CROPPED }
  const crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }
  const { design } = await createFromTemplate(s.deps, { ...INPUT, image: { ...INPUT.image, crop } }, { polls: 3, intervalMs: 1 })
  assert.deepEqual(boxes, [crop]); assert.deepEqual(design.image?.crop, crop); assert.equal(design.image?.bytes, CROPPED.byteLength)
  const upload = s.calls.find(c => c.url.endsWith("/asset-uploads") && c.init.method === "POST")!
  assert.deepEqual(new Uint8Array(upload.init.body as Buffer), CROPPED)
})

test("a crop outside the photo, too small, or with no cropper is refused before anything is fetched", async () => {
  const s = setup(happy)
  s.deps.cropImage = async b => b
  for (const crop of [{ x: 0.5, y: 0, width: 0.6, height: 0.5 }, { x: 0, y: 0, width: 0.05, height: 0.5 }, { x: -0.1, y: 0, width: 0.5, height: 0.5 }])
    await assert.rejects(createFromTemplate(s.deps, { ...INPUT, image: { ...INPUT.image, crop } }), /Crop must be a box inside the photo/)
  delete s.deps.cropImage
  await assert.rejects(createFromTemplate(s.deps, { ...INPUT, image: { ...INPUT.image, crop: { x: 0, y: 0, width: 0.5, height: 0.5 } } }), /Cropping is not available/)
  assert.equal(s.fetched.length, 0)
})

test("the real cropper (sharp) cuts the fractional box from the upright photo", async () => {
  const sharp = (await import("sharp")).default
  const { cropImage } = await import("../image-crop")
  // 400 × 300: left half red, right half blue.
  const raw = Buffer.alloc(400 * 300 * 3)
  for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) raw.set(x < 200 ? [255, 0, 0] : [0, 0, 255], (y * 400 + x) * 3)
  const png = await sharp(raw, { raw: { width: 400, height: 300, channels: 3 } }).png().toBuffer()
  const out = await cropImage(png, { x: 0.5, y: 0.25, width: 0.5, height: 0.5 })
  const meta = await sharp(out).metadata()
  assert.equal(meta.format, "jpeg"); assert.equal(meta.width, 200); assert.equal(meta.height, 150)
  const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
  assert.ok(data[2] > 200 && data[0] < 60, "the right (blue) half was kept")
})

/**
 * A brand's downloadable files for vendors (plan v11.3 Step 4 item 6): delivered copies of the approved marks, made
 * from the originals in 434-context (`90 Assets/06 Standards/Brand Profiles/<brand>-marks/`).
 *
 *   npx tsx scripts/brand-profiles/assets.ts publish <brand id> <marks folder> --files <a.png,b.png> --actor <email>
 *       (--local <folder> | --production) [--env-dir ~/434]
 *
 * For each named file: its bytes as they are (never re-encoded, so the vendor gets the original), a WebP preview for the
 * page, and whether the mark reads on a dark tile (a white mark). Then a manifest naming every file with its sha256,
 * under a time-stamped name. Every object is created only, never replaced (`ifGenerationMatch: 0`): a corrected file
 * is a new versioned name (`-v2`) in a new version of the visual standard (Display and Design Standard §3.0). A name
 * already published with the same bytes is reported and left; with different bytes the run stops.
 *
 * --local writes the same layout to a folder, for BRAND_ASSETS_DIR. --production writes to the private bucket
 * (lib/brand-asset-store.ts), which a working session runs only after the founder's go-ahead for that write.
 * Only the files named in --files go up; which of them a vendor is offered is decided by the brand book's Marks table.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { BRAND_ASSETS_BUCKET, assetPath, thumbPath } from "../../lib/brand-asset-store"

const argv = process.argv.slice(2)
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex")
const TYPES: Record<string, string> = { png: "image/png", svg: "image/svg+xml", ai: "application/postscript", eps: "application/postscript", pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*-v\d+\.[a-z0-9]+$/

/** A light mark (mostly white where it is opaque) is shown on a dark tile. */
async function tileOf(data: Buffer): Promise<"dark" | "light"> {
  const { data: px, info } = await sharp(data).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let sum = 0, n = 0
  for (let i = 0; i < px.length; i += info.channels) {
    if (px[i + 3] < 128) continue
    sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; n++
  }
  return n && sum / n > 0.8 ? "dark" : "light"
}

async function main() {
  const [command, brandId, dir] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--files", "--actor", "--local", "--env-dir"].includes(argv[i - 1])))
  if (command !== "publish" || !brandId || !dir) throw new Error("usage: assets.ts publish <brand id> <marks folder> --files <a,b> --actor <email> (--local <folder> | --production)")
  const files = (flag("--files") ?? "").split(",").map(s => s.trim()).filter(Boolean)
  const actor = flag("--actor") ?? "", local = flag("--local"), production = argv.includes("--production")
  if (!files.length) throw new Error("--files names the files to publish")
  if (!/^[^@\s]+@[^@\s]+$/.test(actor)) throw new Error("--actor <email>")
  if (!!local === production) throw new Error("choose one target: --local <folder> or --production")
  for (const f of files) if (!NAME.test(f)) throw new Error(`${f}: a delivered name carries its version (name-v1.png)`)

  const envDir = flag("--env-dir")
  if (envDir) {
    const { createRequire } = await import("node:module")
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"))
    ;(fromNext("@next/env") as { loadEnvConfig: (dir: string, dev?: boolean, log?: unknown) => unknown }).loadEnvConfig(envDir, false, { info: () => {}, error: console.error })
  }
  const bucket = production ? (await import("../../lib/firebase-admin")).getBucket(BRAND_ASSETS_BUCKET) : null
  console.log(`target: ${production ? `gs://${BRAND_ASSETS_BUCKET}` : local}`)

  /** Creates the object, or confirms an identical one is already there; a different one stops the run. */
  async function put(p: string, data: Buffer, contentType: string, metadata: Record<string, string>) {
    if (bucket) {
      const f = bucket.file(p)
      try {
        await f.save(data, { resumable: false, contentType, metadata: { metadata }, preconditionOpts: { ifGenerationMatch: 0 } })
      } catch (err) {
        if ((err as { code?: number }).code !== 412) throw err
        const [have] = await f.download()
        if (sha256(have) !== sha256(data)) throw new Error(`${p} is already published with different bytes; publish the change under a new version name`)
        console.log(`  ${p}: already published, identical`); return
      }
      const [back] = await f.download()
      if (sha256(back) !== sha256(data)) throw new Error(`${p}: read back differs`)
    } else {
      const out = path.join(local!, p)
      await mkdir(path.dirname(out), { recursive: true })
      await writeFile(out, data, { flag: "wx" }).catch(async err => {
        if (err.code !== "EEXIST" || sha256(await readFile(out)) !== sha256(data)) throw err
      })
      if (Object.keys(metadata).length && !p.endsWith(".json")) await writeFile(`${out}.json`, JSON.stringify(metadata))
    }
    console.log(`  ${p}  ${data.length} bytes  sha256 ${sha256(data).slice(0, 16)}`)
  }

  const at = new Date().toISOString(), manifest: { file: string; bytes: number; sha256: string; tile: string; thumb: boolean }[] = []
  for (const file of files) {
    const data = await readFile(path.join(dir, file)), ext = file.split(".").pop()!.toLowerCase()
    const raster = ["png", "jpg", "jpeg", "webp"].includes(ext)
    const tile = raster ? await tileOf(data) : "light"
    await put(assetPath(brandId, file), data, TYPES[ext] ?? "application/octet-stream", { tile, sha256: sha256(data), published_by: actor, published_at: at })
    if (raster) await put(thumbPath(brandId, file), await sharp(data).resize(240, 160, { fit: "inside" }).webp({ quality: 82 }).toBuffer(), "image/webp", {})
    manifest.push({ file, bytes: data.length, sha256: sha256(data), tile, thumb: raster })
  }
  const stamp = at.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  await put(`brand-assets/${brandId}/manifest-${stamp}.json`, Buffer.from(JSON.stringify({ brand_id: brandId, published_at: at, published_by: actor, source: path.basename(path.resolve(dir)), files: manifest }, null, 2)), "application/json", {})
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })

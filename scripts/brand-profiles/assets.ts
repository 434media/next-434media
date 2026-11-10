/**
 * A brand's downloadable files for vendors (plan v11.3 Step 4 item 6): delivered copies of the approved marks, made
 * from the originals in 434-context (`90 Assets/06 Standards/Brand Profiles/<brand>-marks/`).
 *
 *   npx tsx scripts/brand-profiles/assets.ts publish <brand id> <marks folder> --actor <email>
 *       (--files <a.png,b.svg> --version <id@vN> | --standard <standard.md> --source-path <its path in 434-context>)
 *       (--local <folder> | --production --key <publishing credential> --env-dir ~/434 | --adc)
 *
 * For each file: its bytes as they are (never re-encoded, so the vendor gets the original), a WebP preview for the page
 * and whether the mark reads on a dark tile (a white mark), for PNG and SVG alike (lib/brand-asset-prep.ts). Then a
 * manifest naming every file with its sha256. Every object is created only, never replaced (`ifGenerationMatch: 0`): a
 * corrected file is a new versioned name (`-v2`) in a new version of the visual standard (Display and Design Standard
 * §3.0). A name already published with the same bytes is reported and left; with different bytes the run stops.
 *
 * --standard publishes what a brand's visual standard names (lib/brand-book-publish.ts): the files its Marks table
 * names, each checked first against the folder's SOURCES.md, so a file with no recorded sha256 or a different one stops
 * the run before anything is written. A copy of the standard goes up beside them, for the Admin's Publish brand book.
 * Without it, --files names the files and --version the published profile version whose brand book names them.
 *
 * Targets:
 * - --local writes the same layout to a folder, for BRAND_ASSETS_DIR.
 * - --adc writes with Application Default Credentials: 434-context's brand-assets workflow, federated as the
 *   create-only publisher. It cannot read, so an existing object is not compared here; the Admin's Publish brand book
 *   reads every file with the site's identity and compares it with its recorded sha256 before it publishes.
 * - --production writes with --key, a create-only service-account key (Storage Object Creator), never the site's own
 *   credential, and reads each object back with the site's credential (from --env-dir). The key is never printed.
 * Writes to the bucket run only after the founder's go-ahead for that write.
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { applicationDefault, cert, initializeApp } from "firebase-admin/app"
import { getStorage } from "firebase-admin/storage"
import { BRAND_ASSETS_BUCKET, assetPath, thumbPath } from "../../lib/brand-asset-store"
import { extOf, prepare } from "../../lib/brand-asset-prep"
import { bookFromStandard, namedFiles, recordedIn, sourcesShas, standardPath } from "../../lib/brand-book-publish"

const argv = process.argv.slice(2)
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex")
const TYPES: Record<string, string> = { png: "image/png", svg: "image/svg+xml", ai: "application/postscript", eps: "application/postscript", pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*-v\d+\.[a-z0-9]+$/

async function main() {
  const VALUE = ["--files", "--actor", "--local", "--env-dir", "--version", "--key", "--standard", "--source-path"]
  const [command, brandId, dir] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUE.includes(argv[i - 1])))
  if (command !== "publish" || !brandId || !dir) throw new Error("usage: assets.ts publish <brand id> <marks folder> --actor <email> (--files <a,b> --version <id@vN> | --standard <md> --source-path <path>) (--local <folder> | --production --key <key> | --adc)")
  const actor = flag("--actor") ?? "", local = flag("--local"), production = argv.includes("--production"), adc = argv.includes("--adc")
  if (!/^[^@\s]+@[^@\s]+$/.test(actor)) throw new Error("--actor <email>")
  if ([!!local, production, adc].filter(Boolean).length !== 1) throw new Error("choose one target: --local <folder>, --production or --adc")
  const key = flag("--key")
  if (production && !key) throw new Error("--production needs --key <a create-only publishing credential>; the site's own credential is never used to publish")

  // What to publish: the files a standard names, each checked against SOURCES.md first; or the files named here.
  const standardFile = flag("--standard"), sourcePath = flag("--source-path") ?? ""
  let files: string[], version = flag("--version") ?? "", standardMd: string | null = null
  if (standardFile) {
    if (!sourcePath) throw new Error("--standard needs --source-path <its path in 434-context>")
    standardMd = await readFile(standardFile, "utf8")
    files = namedFiles(bookFromStandard(standardMd, sourcePath))
    if (!files.length) throw new Error(`${standardFile}: its Marks table names no files`)
    const sources = sourcesShas(await readFile(path.join(dir, "SOURCES.md"), "utf8").catch(() => ""))
    const bad: string[] = []
    for (const f of files) {
      const data = await readFile(path.join(dir, f)).catch(() => null)
      if (!data) bad.push(`${f}: not in ${dir}`)
      else if (!recordedIn(sources, f, sha256(data))) bad.push(`${f}: sha256 ${sha256(data).slice(0, 16)} is not the one SOURCES.md records${sources.has(f) ? ` (${sources.get(f)!.join(", ")})` : " (no row)"}`)
    }
    if (bad.length) throw new Error(`Nothing published. Files that don't match SOURCES.md:\n- ${bad.join("\n- ")}`)
  } else {
    files = (flag("--files") ?? "").split(",").map(s => s.trim()).filter(Boolean)
    if (!files.length) throw new Error("--files names the files to publish, or --standard names them")
    if (!(version.startsWith(`${brandId}@v`) && /^\d+$/.test(version.slice(brandId.length + 2)))) throw new Error(`--version <${brandId}@vN>: the published profile version whose brand book names these files`)
  }
  for (const f of files) if (!NAME.test(f)) throw new Error(`${f}: a delivered name carries its version (name-v1.png)`)

  const envDir = flag("--env-dir")
  if (envDir) {
    const { createRequire } = await import("node:module")
    const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"))
    ;(fromNext("@next/env") as { loadEnvConfig: (dir: string, dev?: boolean, log?: unknown) => unknown }).loadEnvConfig(envDir, false, { info: () => {}, error: console.error })
  }
  // Writes go through the create-only publishing credential; reads (the check after each write) through the site's.
  // The reader comes first: the site's getFirebaseApp() adopts whichever app already exists, so made second it would
  // read with the publishing credential, which cannot read.
  const reader = production ? (await import("../../lib/firebase-admin")).getBucket(BRAND_ASSETS_BUCKET) : null
  const credential = production ? cert(JSON.parse(await readFile(key!, "utf8"))) : adc ? applicationDefault() : null
  const bucket = credential ? getStorage(initializeApp({ credential }, "brand-assets-publisher")).bucket(BRAND_ASSETS_BUCKET) : null
  console.log(`target: ${bucket ? `gs://${BRAND_ASSETS_BUCKET}` : local}${adc ? " (application default credentials)" : ""}`)
  const summary: string[] = []

  /** Creates the object, or confirms an identical one is already there; a different one stops the run. */
  async function put(p: string, data: Buffer, contentType: string, metadata: Record<string, string>) {
    if (bucket) {
      try {
        await bucket.file(p).save(data, { resumable: false, contentType, metadata: { metadata }, preconditionOpts: { ifGenerationMatch: 0 } })
      } catch (err) {
        const { code, message } = err as { code?: number; message?: string }
        if (code === 412) {
          if (!reader) { console.log(`  ${p}: already published (not compared here: the publisher cannot read)`); summary.push(`| \`${p}\` | already there | not compared here |`); return }
          const [have] = await reader.file(p).download()
          if (sha256(have) !== sha256(data)) throw new Error(`${p} is already published with different bytes; publish the change under a new version name`)
          console.log(`  ${p}: already published, identical`); return
        }
        // Storage creates the object, then answers with its metadata, which a create-only credential may not read: the
        // write has landed, and the read-back below is the check.
        if (!(code === 403 && message?.includes("storage.objects.get"))) throw err
      }
      if (reader) {
        const [back] = await reader.file(p).download()
        if (sha256(back) !== sha256(data)) throw new Error(`${p}: read back differs`)
      }
    } else {
      const out = path.join(local!, p)
      await mkdir(path.dirname(out), { recursive: true })
      await writeFile(out, data, { flag: "wx" }).catch(async err => {
        if (err.code !== "EEXIST" || sha256(await readFile(out)) !== sha256(data)) throw err
      })
      if (Object.keys(metadata).length && !p.endsWith(".json")) await writeFile(`${out}.json`, JSON.stringify(metadata))
    }
    console.log(`  ${p}  ${data.length} bytes  sha256 ${sha256(data).slice(0, 16)}`)
    summary.push(`| \`${p}\` | created, ${data.length} bytes | \`${sha256(data)}\` |`)
  }

  const at = new Date().toISOString(), manifest: { file: string; bytes: number; sha256: string; tile: string; thumb: boolean }[] = []
  for (const file of files) {
    const data = await readFile(path.join(dir, file)), ext = extOf(file)
    const { tile, preview } = await prepare(file, data)
    await put(assetPath(brandId, file), data, TYPES[ext] ?? "application/octet-stream", { tile, sha256: sha256(data), published_by: actor, published_at: at })
    if (preview) await put(thumbPath(brandId, file), preview, "image/webp", {})
    manifest.push({ file, bytes: data.length, sha256: sha256(data), tile, thumb: !!preview })
  }
  const stamp = at.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  let named = `manifest-${version.replace("@", "-")}-${stamp}.json`, standard: object | undefined
  if (standardMd !== null) {
    const p = standardPath(brandId, standardMd)
    await put(p, Buffer.from(standardMd, "utf8"), "text/markdown; charset=utf-8", { source_path: sourcePath, sha256: sha256(standardMd), published_by: actor, published_at: at })
    named = `manifest-standard-${sha256(standardMd).slice(0, 16)}-${stamp}.json`
    standard = { object: p, source_path: sourcePath, sha256: sha256(standardMd) }
  }
  await put(`brand-assets/${brandId}/${named}`, Buffer.from(JSON.stringify({ brand_id: brandId, ...(version ? { book_version: version } : {}), ...(standard ? { standard } : {}), published_at: at, published_by: actor, source: path.basename(path.resolve(dir)), files: manifest }, null, 2)), "application/json", {})
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises")
    await appendFile(process.env.GITHUB_STEP_SUMMARY, [`### ${brandId}: brand files`, "", "| Object | Result | sha256 |", "|---|---|---|", ...summary, ""].join("\n") + "\n")
  }
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { isKeyless, keylessAccessToken, SCOPES } from "./gcp-keyless"

/**
 * Where a vendor's downloadable brand files are kept (plan v11.3 Step 4 item 6): the delivered copies of a brand's
 * approved marks, made from the originals in 434-context (`90 Assets/06 Standards/Brand Profiles/<brand>-marks/`) by
 * `scripts/brand-profiles/assets.ts publish`.
 *
 * A private bucket, `gs://<bucket>/brand-assets/<brand id>/<file>`, with a small WebP preview at
 * `…/thumbs/<file>.webp`. Private because the link is the gate: the site reads the files with its own service account
 * and hands them over only through a share whose link still opens, so an expired or revoked link gets nothing. (The
 * site's media bucket is public to anyone with the address, so it is not used here.) Names carry their version
 * (`-v1`) and are written create-only, so a file is never replaced under a share that pinned it.
 *
 * BRAND_ASSETS_DIR serves the same layout from a local folder instead, for working on the page without storage. It is
 * refused in production.
 */
export const BRAND_ASSETS_BUCKET = process.env.BRAND_ASSETS_BUCKET || "434-media-sources"
export const assetPath = (brandId: string, file: string) => `brand-assets/${brandId}/${file}`
export const thumbPath = (brandId: string, file: string) => `brand-assets/${brandId}/thumbs/${file}.webp`
/** Where the brand-assets workflow keeps each copy of a brand's standard (lib/brand-book-publish.ts). */
export const standardPrefix = (brandId: string) => `brand-assets/${brandId}/standards/`

/** A delivered file's size, whether its mark reads on a dark tile (a white mark) or a light one, and the sha256 its
 * publisher recorded (null when none was). */
export interface AssetInfo { bytes: number; dark: boolean; sha256: string | null }
/** The newest copy of a brand's visual standard the brand-assets workflow put in storage (lib/brand-book-publish.ts). */
export interface StoredStandard { object: string; generation: string; md: string; sourcePath: string }
export interface BrandAssetStore {
  info(brandId: string, file: string): Promise<AssetInfo | null>
  read(brandId: string, file: string): Promise<Buffer | null>
  /** The preview, when one was made. */
  thumb(brandId: string, file: string): Promise<Buffer | null>
  /** The newest standard copy, by creation time; null when there is none. */
  latestStandard(brandId: string): Promise<StoredStandard | null>
}

const recorded = (m: { sha256?: unknown } | undefined) => typeof m?.sha256 === "string" && /^[0-9a-f]{64}$/.test(m.sha256) ? m.sha256 : null

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const safe = (brandId: string, file: string) => SAFE.test(brandId) && SAFE.test(file) && !file.includes("..")

export function brandAssetStore(): BrandAssetStore {
  const dir = process.env.BRAND_ASSETS_DIR
  if (dir) {
    if (process.env.NODE_ENV === "production") throw new Error("BRAND_ASSETS_DIR is for local work only")
    return localStore(dir)
  }
  return isKeyless() ? restStore() : bucketStore()
}

/**
 * The same bucket through the Cloud Storage JSON API, for the keyless path (lib/gcp-keyless.ts): firebase-admin's
 * Storage client takes only a key, and these reads are two plain GETs.
 */
function restStore(): BrandAssetStore {
  const object = async (p: string, media: boolean) => {
    const url =
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BRAND_ASSETS_BUCKET)}` +
      `/o/${encodeURIComponent(p)}${media ? "?alt=media" : ""}`
    const res = await fetch(url, { headers: { authorization: `Bearer ${(await keylessAccessToken(SCOPES.cloud)).token}` } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Brand asset read failed (HTTP ${res.status})`)
    return res
  }
  const get = async (p: string) => {
    const res = await object(p, true)
    return res ? Buffer.from(await res.arrayBuffer()) : null
  }
  return {
    async info(brandId, file) {
      if (!safe(brandId, file)) return null
      const res = await object(assetPath(brandId, file), false)
      if (!res) return null
      const m = (await res.json()) as { size?: string; metadata?: { tile?: string; sha256?: string } }
      return { bytes: Number(m.size) || 0, dark: m.metadata?.tile === "dark", sha256: recorded(m.metadata) }
    },
    read: async (brandId, file) => safe(brandId, file) ? get(assetPath(brandId, file)) : null,
    thumb: async (brandId, file) => safe(brandId, file) ? get(thumbPath(brandId, file)) : null,
    async latestStandard(brandId) {
      if (!SAFE.test(brandId)) return null
      const auth = { authorization: `Bearer ${(await keylessAccessToken(SCOPES.cloud)).token}` }
      const list = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BRAND_ASSETS_BUCKET)}/o?prefix=${encodeURIComponent(standardPrefix(brandId))}&fields=items(name,generation,timeCreated,metadata)`, { headers: auth })
      if (!list.ok) throw new Error(`Brand standard list failed (HTTP ${list.status})`)
      const items = ((await list.json()) as { items?: { name: string; generation: string; timeCreated: string; metadata?: { source_path?: string } }[] }).items ?? []
      const top = items.filter(i => i.name.endsWith(".md")).sort((a, b) => b.timeCreated.localeCompare(a.timeCreated))[0]
      if (!top) return null
      const res = await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BRAND_ASSETS_BUCKET)}/o/${encodeURIComponent(top.name)}?alt=media&generation=${top.generation}`, { headers: auth })
      if (!res.ok) throw new Error(`Brand standard read failed (HTTP ${res.status})`)
      return { object: top.name, generation: top.generation, md: await res.text(), sourcePath: top.metadata?.source_path ?? top.name }
    },
  }
}

function bucketStore(): BrandAssetStore {
  const bucket = async () => (await import("./firebase-admin")).getBucket(BRAND_ASSETS_BUCKET)
  const get = async (p: string) => {
    try { return (await (await bucket()).file(p).download())[0] }
    catch (err) { if ((err as { code?: number }).code === 404) return null; throw err }
  }
  return {
    async info(brandId, file) {
      if (!safe(brandId, file)) return null
      try {
        const [m] = await (await bucket()).file(assetPath(brandId, file)).getMetadata()
        return { bytes: Number(m.size) || 0, dark: m.metadata?.tile === "dark", sha256: recorded(m.metadata as { sha256?: unknown } | undefined) }
      } catch (err) { if ((err as { code?: number }).code === 404) return null; throw err }
    },
    read: async (brandId, file) => safe(brandId, file) ? get(assetPath(brandId, file)) : null,
    thumb: async (brandId, file) => safe(brandId, file) ? get(thumbPath(brandId, file)) : null,
    async latestStandard(brandId) {
      if (!SAFE.test(brandId)) return null
      const [files] = await (await bucket()).getFiles({ prefix: standardPrefix(brandId) })
      const top = files.filter(f => f.name.endsWith(".md")).sort((a, b) => String(b.metadata.timeCreated).localeCompare(String(a.metadata.timeCreated)))[0]
      if (!top) return null
      const [data] = await top.download()
      return { object: top.name, generation: String(top.metadata.generation), md: data.toString("utf8"), sourcePath: String(top.metadata.metadata?.source_path ?? top.name) }
    },
  }
}

/** The bucket's layout in a folder, with `<file>.json` beside a file holding its metadata ({"tile": "dark"}). */
export function localStore(root: string): BrandAssetStore {
  const at = (p: string) => path.join(root, p)
  const get = async (p: string) => { try { return await readFile(at(p)) } catch { return null } }
  return {
    async info(brandId, file) {
      if (!safe(brandId, file)) return null
      try {
        const s = await stat(at(assetPath(brandId, file)))
        const meta = JSON.parse((await get(`${assetPath(brandId, file)}.json`))?.toString("utf8") ?? "{}") as { tile?: string; sha256?: string }
        return { bytes: s.size, dark: meta.tile === "dark", sha256: recorded(meta) }
      } catch { return null }
    },
    read: async (brandId, file) => safe(brandId, file) ? get(assetPath(brandId, file)) : null,
    thumb: async (brandId, file) => safe(brandId, file) ? get(thumbPath(brandId, file)) : null,
    async latestStandard(brandId) {
      if (!SAFE.test(brandId)) return null
      const dir = at(standardPrefix(brandId))
      const names = (await readdir(dir).catch(() => [] as string[])).filter(n => n.endsWith(".md"))
      const dated = await Promise.all(names.map(async n => ({ n, t: (await stat(path.join(dir, n))).mtimeMs })))
      const top = dated.sort((a, b) => b.t - a.t)[0]
      if (!top) return null
      const meta = JSON.parse((await get(`${standardPrefix(brandId)}${top.n}.json`))?.toString("utf8") ?? "{}") as { source_path?: string }
      return { object: `${standardPrefix(brandId)}${top.n}`, generation: String(Math.floor(top.t)), md: (await readFile(path.join(dir, top.n))).toString("utf8"), sourcePath: meta.source_path ?? top.n }
    },
  }
}

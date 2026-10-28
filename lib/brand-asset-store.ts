import { readFile, stat } from "node:fs/promises"
import path from "node:path"

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

/** A delivered file's size, and whether its mark reads on a dark tile (a white mark) or a light one. */
export interface AssetInfo { bytes: number; dark: boolean }
export interface BrandAssetStore {
  info(brandId: string, file: string): Promise<AssetInfo | null>
  read(brandId: string, file: string): Promise<Buffer | null>
  /** The preview, when one was made. */
  thumb(brandId: string, file: string): Promise<Buffer | null>
}

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const safe = (brandId: string, file: string) => SAFE.test(brandId) && SAFE.test(file) && !file.includes("..")

export function brandAssetStore(): BrandAssetStore {
  const dir = process.env.BRAND_ASSETS_DIR
  if (dir) {
    if (process.env.NODE_ENV === "production") throw new Error("BRAND_ASSETS_DIR is for local work only")
    return localStore(dir)
  }
  return bucketStore()
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
        return { bytes: Number(m.size) || 0, dark: m.metadata?.tile === "dark" }
      } catch (err) { if ((err as { code?: number }).code === 404) return null; throw err }
    },
    read: async (brandId, file) => safe(brandId, file) ? get(assetPath(brandId, file)) : null,
    thumb: async (brandId, file) => safe(brandId, file) ? get(thumbPath(brandId, file)) : null,
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
        const meta = JSON.parse((await get(`${assetPath(brandId, file)}.json`))?.toString("utf8") ?? "{}") as { tile?: string }
        return { bytes: s.size, dark: meta.tile === "dark" }
      } catch { return null }
    },
    read: async (brandId, file) => safe(brandId, file) ? get(assetPath(brandId, file)) : null,
    thumb: async (brandId, file) => safe(brandId, file) ? get(thumbPath(brandId, file)) : null,
  }
}

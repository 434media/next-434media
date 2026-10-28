import { NextResponse } from "next/server"
import { openShare } from "@/lib/brand-share-open"
import { fontNote, pickedFiles, vendorFiles, zipName, zipStore } from "@/lib/brand-assets"
import { brandAssetStore } from "@/lib/brand-asset-store"

export const dynamic = "force-dynamic"

/** A response this size is refused before it is built: the platform's limit on a function's response is 4.5 MB. */
const MAX_ZIP_BYTES = 4 * 1024 * 1024

const plain = (status: number, text: string) =>
  new NextResponse(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } })

/**
 * Download selected on a vendor's brand page (plan v11.3 Step 4 item 6): one zip of the ticked files, through the same
 * expiring link. `?f=<id>` names each file: a logo's file name or `font:<face>`, and only what the share's own book
 * offers is accepted, so a request can never name a path. Logos go in byte-identical to their delivered copies under
 * `logos/`; a font is a note with its source and licence under `fonts/`. Nothing else is added.
 *
 * A link that no longer opens (expired, revoked, unknown), or a request with nothing to download, is sent back to the
 * page, which refuses or shows the book as it would. A selection over the cap is refused (413) from the files' stored
 * sizes, before anything is read; storage that cannot be read is a plain 503, never an error page. Each download is
 * recorded on the share, with its files.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const page = new URL(`/share/brand-book/${token}`, req.url)
  const opened = await openShare(token)
  if (!opened) return NextResponse.redirect(page, 303)
  const { share, book, label, versionId, store } = opened
  const files = vendorFiles(book), assets = brandAssetStore()
  const ids = new URL(req.url).searchParams.getAll("f").slice(0, 100)
  const entries: { name: string; data: Uint8Array }[] = []
  try {
    // Sizes first, from storage's metadata: the cap is checked before any file is read into memory.
    const sizes = new Map<string, number>()
    for (const l of files.logos.filter(l => ids.includes(l.id))) {
      const info = await assets.info(share.brand_id, l.file)
      if (info) sizes.set(l.file, info.bytes)
    }
    const picked = pickedFiles(files, ids, f => sizes.has(f))
    if (!picked.logos.length && !picked.fonts.length) return NextResponse.redirect(page, 303)
    if (picked.logos.reduce((n, l) => n + sizes.get(l.file)!, 0) > MAX_ZIP_BYTES) return plain(413, "Those files are too large for one download. Choose fewer and download them in two goes.")
    for (const l of picked.logos) {
      const data = await assets.read(share.brand_id, l.file)
      if (!data) return NextResponse.redirect(page, 303)
      entries.push({ name: `logos/${l.file}`, data })
    }
    for (const f of picked.fonts) entries.push({ name: `fonts/${f.face}.txt`, data: Buffer.from(fontNote(f, label), "utf8") })
  } catch (err) {
    // Storage refused or failed: say so plainly, record nothing.
    console.error("[share/brand-book] files unreadable", share.id, err)
    return plain(503, "The files can't be fetched right now. Please try again in a few minutes.")
  }
  const zip = zipStore(entries)
  await store.recordDownload(share.id, new Date().toISOString(), entries.map(e => e.name)).catch(err => console.error("[share/brand-book] download not recorded", share.id, err))
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName(label, versionId)}"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

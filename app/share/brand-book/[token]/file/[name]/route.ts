import { NextResponse } from "next/server"
import { openShare } from "@/lib/brand-share-open"
import { vendorFiles } from "@/lib/brand-assets"
import { brandAssetStore } from "@/lib/brand-asset-store"

export const dynamic = "force-dynamic"

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" }

/**
 * A logo's thumbnail on a vendor's brand page (plan v11.3 Step 4 item 6): its WebP preview, or the file itself where
 * no preview was made and the file is an image a browser draws. Only a logo the share's own book names, and only while
 * the link opens: an expired or revoked link gets nothing here either. Not cached, so a Revoke holds at once.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await params
  const opened = await openShare(token)
  // `name` arrives decoded; a delivered name is [A-Za-z0-9._-] only, so it is compared as it is.
  const logo = opened && vendorFiles(opened.book).logos.find(l => l.file === name)
  if (!opened || !logo) return new NextResponse(null, { status: 404 })
  const assets = brandAssetStore()
  const ext = logo.file.split(".").pop()!.toLowerCase()
  let thumb: Buffer | null = null, data: Buffer | null = null
  try {
    thumb = await assets.thumb(opened.share.brand_id, logo.file)
    data = thumb ?? (TYPES[ext] && ext !== "svg" ? await assets.read(opened.share.brand_id, logo.file) : null)
  } catch (err) {
    // Storage refused or failed: no preview, never an error page.
    console.error("[share/brand-book] preview unreadable", logo.file, err)
    return new NextResponse(null, { status: 404 })
  }
  if (!data) return new NextResponse(null, { status: 404 })
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": thumb ? "image/webp" : TYPES[ext],
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

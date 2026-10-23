"use client"

import { upload } from "@vercel/blob/client"
import { UPLOAD_PREFIX } from "@/lib/content-pipeline/create-media"
import type { RowMedia } from "@/lib/content-pipeline/create-table"

/**
 * Getting a row's media, shared by the Create table's Media cell and the drawer's Replace media (Step 3 part 4): a
 * dropped file goes straight from the browser to Blob storage and is optimized; a pasted file link is optimized; a
 * Canva design link is exported by the app (MP4 or JPG), so nobody exports a video from Canva by hand.
 */
export type MediaResult = { media: RowMedia; message: string }

/** A canva.com/design/… link or a canva.link share link. */
export function isCanvaLink(raw: string): boolean {
  try { const u = new URL(raw.trim()); return u.protocol === "https:" && (/(^|\.)canva\.com$/.test(u.hostname) && u.pathname.startsWith("/design/") || u.hostname === "canva.link") } catch { return false }
}

async function optimize(url: string, name: string, size?: number): Promise<MediaResult> {
  const res = await fetch("/api/admin/content/media-optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, name: name.slice(0, 120) }) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "The media could not be optimized")
  const media = data.media as RowMedia
  return { media: { ...media, bytes: media.bytes ?? size }, message: data.action === "resized" ? "Photo resized ✓" : "Video ready ✓" }
}

export async function mediaFromFile(file: File): Promise<MediaResult> {
  const blob = await upload(`${UPLOAD_PREFIX}${file.name.replace(/[^\w.-]+/g, "_").slice(0, 80)}`, file, { access: "public", handleUploadUrl: "/api/admin/content/media-upload", multipart: file.size > 50 * 1024 * 1024, contentType: file.type || undefined })
  return optimize(blob.url, file.name, file.size)
}

export const mediaFromLink = (url: string) => optimize(url, url.split("/").pop()?.split("?")[0] || "media")

export async function mediaFromCanva(designLink: string, as: "video" | "photo"): Promise<MediaResult> {
  const res = await fetch("/api/admin/content/media-canva", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ designLink: designLink.trim(), as }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "The Canva design could not be exported")
  return { media: data.media as RowMedia, message: as === "video" ? "Exported from Canva as MP4 ✓" : "Exported from Canva as JPG ✓" }
}

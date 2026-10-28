import type { Metadata } from "next"
import { headers } from "next/headers"
import { BrandBook, type BookPicks } from "@/components/admin/brands/BrandBook"
import { isAutomatedOpen } from "@/lib/brand-share"
import { openShare } from "@/lib/brand-share-open"
import { vendorFiles } from "@/lib/brand-assets"
import { brandAssetStore } from "@/lib/brand-asset-store"
import { VendorFilesBar } from "./VendorFilesBar"

export const dynamic = "force-dynamic"

/**
 * A brand book shared with a vendor (plan v11.2.1 Step 4 item 4), and the files a designer works from (v11.3 item 6).
 * The link's token is looked up by its hash; an unknown, expired, revoked or failed share refuses (lib/brand-share-open.ts).
 * Each opening by a person is recorded on the share (a prefetch or a link scanner is not, and openings within a minute
 * are one). The book is the one the share pinned (its profile version), rendered by the same component as the brand
 * page, each section folding and open.
 *
 * Each logo file the book names and each open-licence face has a tick box; Download selected returns one zip through
 * the same link (./download), and the thumbnails come through it too (./file). Save as PDF is the browser's own
 * rendering of this page with its print styles, made on request and never stored.
 *
 * Never indexed, and no referrer leaves the page, so the token in its address goes nowhere else. The card names the
 * purpose only: a link preview is rendered and cached by services the recipient does not control.
 */
const TITLE = "Shared brand book"
const FORM = "vendor-files"
export const metadata: Metadata = {
  title: TITLE,
  description: "Shared by 434 MEDIA.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: { type: "website", title: TITLE, description: "Shared by 434 MEDIA." },
  twitter: { card: "summary", title: TITLE, description: "Shared by 434 MEDIA." },
}

export default async function SharedBrandBook({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const opened = await openShare(token)
  if (!opened) return <Refused />
  const { share, book, label, versionId, expiresAt, store } = opened
  // A prefetch or a mail or chat link scanner is answered, not counted; the store merges openings within a minute.
  if (!isAutomatedOpen(await headers())) await store.recordView(share.id, new Date().toISOString()).catch(err => console.error("[share/brand-book] view not recorded", share.id, err))

  const files = vendorFiles(book), assets = brandAssetStore()
  const infos = await Promise.all(files.logos.map(l => assets.info(share.brand_id, l.file).catch(err => { console.error("[share/brand-book] file unreadable", l.file, err); return null })))
  const base = `/share/brand-book/${token}`
  const picks: BookPicks = {
    formId: FORM,
    logos: Object.fromEntries(files.logos.map((l, i) => [l.file, { id: l.id, available: !!infos[i], dark: !!infos[i]?.dark, thumb: `${base}/file/${encodeURIComponent(l.file)}` }])),
    fonts: Object.fromEntries(files.fonts.map(f => [f.face, { id: f.id, sourceUrl: f.sourceUrl! }])),
  }
  const total = infos.filter(Boolean).length + files.fonts.length
  return (
    <main className="min-h-screen bg-white px-4 pt-8 sm:px-8 print:p-0">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 border-b border-neutral-200 pb-3 text-xs text-neutral-500 print:hidden">Shared by 434 MEDIA · this link works until {new Date(expiresAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })}</p>
        <form id={FORM} method="get" action={`${base}/download`} />
        <BrandBook book={book} brand={label} versionId={versionId} view="designer" collapsible open picks={picks} />
        {total > 0 && <p className="mt-4 text-xs text-neutral-500 print:hidden">Tick the logo and font files you need, then Download selected. Fonts come as a note with the link to their free source and their licence.</p>}
        <VendorFilesBar formId={FORM} total={total} />
      </div>
    </main>
  )
}

function Refused() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-neutral-900">This link doesn&apos;t open</h1>
        <p className="mt-2 text-sm text-neutral-600">It has expired or was withdrawn. Ask the person at 434 MEDIA who sent it for a new one.</p>
      </div>
    </main>
  )
}

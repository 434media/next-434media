import type { Metadata } from "next"
import { headers } from "next/headers"
import { BrandBook } from "@/components/admin/brands/BrandBook"
import { vendorBook } from "@/lib/content-pipeline/brand-book"
import { hashShareToken, isAutomatedOpen, isShareToken, shareState } from "@/lib/brand-share"
import { DownloadPdf } from "./DownloadPdf"

export const dynamic = "force-dynamic"

/**
 * A brand book shared with a vendor (plan v11.2.1 Step 4 item 4). The link's token is looked up by its hash; an
 * unknown, expired, revoked or failed share refuses. Each opening by a person is recorded on the share (a prefetch or a
 * link scanner is not, and openings within a minute are one). The book is the one the
 * share pinned (its profile version), rendered by the same component as the brand page; Download PDF is the browser's
 * own rendering of this page with its print styles, made on request and never stored.
 *
 * Never indexed, and no referrer leaves the page, so the token in its address goes nowhere else. The card names the
 * purpose only: a link preview is rendered and cached by services the recipient does not control.
 */
const TITLE = "Shared brand book"
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
  const opened = isShareToken(token) ? await open(token) : null
  if (!opened) return <Refused />
  const { book, label, versionId, expiresAt } = opened
  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-8 print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4 print:hidden">
          <p className="text-xs text-neutral-500">Shared by 434 MEDIA · this link works until {new Date(expiresAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })}</p>
          <DownloadPdf />
        </div>
        <BrandBook book={book} brand={label} versionId={versionId} view="designer" />
      </div>
    </main>
  )
}

/** The share's pinned book, with its view recorded; null when the link must refuse. */
async function open(token: string) {
  const [{ firestoreBrandShares }, { pinnedBook }] = await Promise.all([import("@/lib/firestore-brand-shares"), import("@/lib/brand-share-deps")])
  const store = firestoreBrandShares(), now = new Date()
  const share = await store.byTokenHash(hashShareToken(token))
  if (!share || shareState(share, now) !== "active" || share.status !== "sent") return null
  const pinned = await pinnedBook(share.brand_id, share.version_n)
  if (!pinned) return null
  // A prefetch or a mail or chat link scanner is answered, not counted; the store merges openings within a minute.
  if (!isAutomatedOpen(await headers())) await store.recordView(share.id, now.toISOString()).catch(err => console.error("[share/brand-book] view not recorded", share.id, err))
  // Only the vendor's copy leaves the server: the book's internal blocks are dropped here, before anything renders.
  return { book: vendorBook(pinned.book), label: pinned.label, versionId: share.version_id, expiresAt: share.expires_at }
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

import type { Metadata } from "next"
import { getPublicFeedItems } from "@/lib/thefeed"
import { FeedList } from "@/components/thefeed/FeedList"

// Read from Firestore on every request, so a post published in /admin/feed-form
// appears at once. Same reason as the blog.
export const dynamic = "force-dynamic"

// Moved from the Digital Canvas site (founder, 2026-10-24). On 434media.com it
// is 434's own surface: palette tokens and the visual system's type roles.

const description =
  "Field notes from the work: cohort builds, demo days, workshops and the San Antonio builder ecosystem, from 434 MEDIA and Digital Canvas."

const ogImage = `/api/og?${new URLSearchParams({ title: "The Feed", subtitle: "Field notes from the work", path: "/thefeed" })}`

export const metadata: Metadata = {
  title: "The Feed",
  description,
  alternates: { canonical: "/thefeed" },
  openGraph: {
    title: "The Feed | 434 MEDIA",
    description,
    url: "/thefeed",
    siteName: "434 MEDIA",
    type: "website",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "The Feed — field notes from the work" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Feed | 434 MEDIA",
    description,
    images: [ogImage],
    creator: "@434media",
    site: "@434media",
  },
}

export default async function TheFeedPage() {
  const items = await getPublicFeedItems()

  return (
    <div className="min-h-screen bg-[var(--434-background)] text-[var(--434-text)] pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200 pb-8 mb-10">
          <p className="t-label text-neutral-500 mb-4">Field notes</p>
          <h1 className="t-display-l text-neutral-900">
            The Feed <span className="t-metadata-l text-neutral-500 align-top">({items.length})</span>
          </h1>
          <p className="t-body-l text-neutral-600 mt-5 max-w-3xl">
            Field notes from the work — workflows we shipped, loops we tuned, design choices we&apos;re still
            defending. New posts whenever there&apos;s something worth saying.
          </p>
        </header>

        <main>
          <p className="t-label text-neutral-500 pb-3">Posts</p>
          <FeedList items={items} />
        </main>
      </div>
    </div>
  )
}

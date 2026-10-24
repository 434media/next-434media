import type { Metadata } from "next"
import { getPublicFeedItems } from "@/lib/thefeed"
import { FeedList } from "@/components/thefeed/FeedList"
import { FeedVideo } from "@/components/thefeed/FeedVideo"

// Read from Firestore on every request, so a post published in /admin/feed-form
// appears at once. Same reason as the blog.
export const dynamic = "force-dynamic"

const description =
  "Field notes from the work — cohort builds, demo days, workshops, and the San Antonio builder ecosystem. Articles, videos, newsletters and podcasts from Digital Canvas."

export const metadata: Metadata = {
  title: "The Feed | Digital Canvas",
  description,
  alternates: { canonical: "/thefeed" },
  openGraph: {
    title: "The Feed | Digital Canvas",
    description,
    url: "/thefeed",
    type: "website",
    images: [{ url: "/api/og/thefeed", width: 1200, height: 630, alt: "The Feed — field notes from Digital Canvas" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Feed | Digital Canvas",
    description,
    images: ["/api/og/thefeed"],
    creator: "@434media",
    site: "@434media",
  },
}

const LABEL =
  "font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] text-white/40 font-normal"

export default async function TheFeedPage() {
  const items = await getPublicFeedItems()

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="border-b border-[#222] pb-8 mb-10">
          <h1 className="font-(family-name:--font-geist-pixel-square) text-3xl md:text-4xl lg:text-5xl font-bold text-white uppercase tracking-wide leading-[1.15]">
            The Feed
            <sup className="text-base md:text-lg lg:text-xl ml-2 font-normal text-white/40">({items.length})</sup>
          </h1>
          <p className="mt-5 text-base md:text-lg text-white/50 max-w-3xl leading-[1.8] font-light">
            Field notes from the work — workflows we shipped, loops we tuned, design choices we&apos;re still defending. New posts whenever there&apos;s something worth saying.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-10">
          <aside className="lg:w-[380px] shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="border-b border-[#222] pb-3 mb-6">
                <span className={LABEL}>/ Info</span>
              </div>
              <div className="relative aspect-2/1 w-full overflow-hidden border border-[#222] bg-black rounded-sm">
                <FeedVideo />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`${LABEL} tracking-[0.25em] text-white/30`}>Digital Canvas</span>
                <span className={`${LABEL} tracking-[0.25em] text-[#88FF00]/60`}>434 Media</span>
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <div className="border-b border-[#222] pb-3 mb-6">
              <span className={LABEL}>/ Topics</span>
            </div>
            <FeedList items={items} />
          </main>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getPublicFeedItem } from "@/lib/thefeed"
import { NewsletterTemplate } from "@/components/thefeed/NewsletterTemplate"
import { FeedSignup } from "@/components/thefeed/FeedSignup"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = await getPublicFeedItem(slug)
  if (!item) return { title: "Not Found | The Feed" }

  const ogTitle = item.ogTitle || item.title
  const ogDescription = item.ogDescription || item.summaryText
  const images = item.ogImage
    ? [{ url: item.ogImage, width: 1200, height: 630, alt: ogTitle }]
    : [{ url: "/api/og/thefeed", width: 1200, height: 630, alt: "The Feed — field notes from Digital Canvas" }]

  return {
    title: `${item.title} | The Feed - Digital Canvas`,
    description: item.summaryText,
    authors: item.authors.map((name) => ({ name })),
    alternates: { canonical: `/thefeed/${item.slug}` },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `/thefeed/${item.slug}`,
      type: "article",
      publishedTime: item.published_date,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: images.map((i) => i.url),
    },
  }
}

const TYPE_COLORS = {
  video: "bg-black text-white",
  article: "bg-gray-100 text-gray-800",
  podcast: "bg-gray-800 text-white",
  newsletter: "bg-gray-100 text-gray-800",
} as const

export default async function FeedPostPage({ params }: Props) {
  const { slug } = await params
  const item = await getPublicFeedItem(slug)
  if (!item) notFound()

  return (
    <div className="min-h-screen bg-white pt-28 pb-20">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/thefeed"
          className="inline-flex items-center gap-2 mb-10 text-sm text-gray-500 hover:text-black transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </Link>

        <header className="border-b border-gray-200 pb-10 mb-12">
          <div className="flex items-center gap-3 mb-5">
            <time dateTime={item.published_date} className="text-sm text-gray-500 font-medium">{item.date}</time>
            <span className="text-gray-300">•</span>
            <span className={`text-[11px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-sm ${TYPE_COLORS[item.type]}`}>
              {item.type}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] mb-6 text-gray-900">
            {item.title}
          </h1>

          {item.summaryText && (
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-3xl">{item.summaryText}</p>
          )}

          <div className="flex flex-wrap gap-8 text-sm">
            {item.authors.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 block mb-2">Authors</span>
                <div className="flex flex-wrap gap-2">
                  {item.authors.map((author) => (
                    <span key={author} className="font-medium text-gray-700">{author}</span>
                  ))}
                </div>
              </div>
            )}
            {item.topics.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 block mb-2">Topics</span>
                <div className="flex flex-wrap gap-2">
                  {item.topics.map((topic) => (
                    <span key={topic} className="text-xs font-medium uppercase tracking-wide px-2.5 py-1 bg-gray-100 text-gray-700 rounded-sm">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Only newsletters carry a body. Other types are their header alone,
            as on the Digital Canvas site, minus its placeholder copy. */}
        {item.newsletterContent && <NewsletterTemplate content={item.newsletterContent} />}

        <FeedSignup />
      </article>
    </div>
  )
}

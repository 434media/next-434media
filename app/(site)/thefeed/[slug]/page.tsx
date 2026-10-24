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
  const fallback = `/api/og?${new URLSearchParams({ title: item.title, subtitle: "The Feed", path: `/thefeed/${item.slug}` })}`
  const images = [{ url: item.ogImage || fallback, width: 1200, height: 630, alt: ogTitle }]

  return {
    title: `${item.title} | The Feed`,
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

export default async function FeedPostPage({ params }: Props) {
  const { slug } = await params
  const item = await getPublicFeedItem(slug)
  if (!item) notFound()

  return (
    <div className="min-h-screen bg-[var(--434-background)] text-[var(--434-text)] pt-28 pb-20">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/thefeed"
          className="t-body-s inline-flex items-center gap-2 mb-10 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to The Feed
        </Link>

        <header className="border-b border-neutral-200 pb-10 mb-12">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <time dateTime={item.published_date} className="t-metadata text-neutral-500">{item.date}</time>
            <span className="t-label text-neutral-600 border border-neutral-300 px-2 py-0.5">{item.type}</span>
          </div>

          <h1 className="font-ggx88 t-display-m text-neutral-900 mb-6">{item.title}</h1>

          {item.summaryText && <p className="t-body-xl text-neutral-600 mb-8 max-w-3xl">{item.summaryText}</p>}

          <div className="flex flex-wrap gap-8">
            {item.authors.length > 0 && (
              <div>
                <span className="t-label text-neutral-500 block mb-2">Authors</span>
                <div className="flex flex-wrap gap-2">
                  {item.authors.map((author) => (
                    <span key={author} className="t-body-s text-neutral-800">{author}</span>
                  ))}
                </div>
              </div>
            )}
            {item.topics.length > 0 && (
              <div>
                <span className="t-label text-neutral-500 block mb-2">Topics</span>
                <div className="flex flex-wrap gap-2">
                  {item.topics.map((topic) => (
                    <span key={topic} className="t-caption text-neutral-700 bg-neutral-100 px-2.5 py-1">{topic}</span>
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

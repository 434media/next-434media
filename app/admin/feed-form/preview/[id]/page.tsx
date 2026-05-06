"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { Marked } from "marked"
import { ArrowLeft, Calendar, ExternalLink, Loader2 } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"

const previewMarked = new Marked({ async: false, gfm: true, breaks: true })

interface FeedItem {
  id?: string
  published_date: string
  title: string
  type: "video" | "article" | "podcast" | "newsletter"
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  og_image?: string
  status: "draft" | "published" | "archived"

  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string

  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string

  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string

  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string
}

function md(value: string | undefined): string {
  if (!value) return ""
  try {
    return previewMarked.parse(value) as string
  } catch {
    return value.replace(/\n/g, "<br />")
  }
}

function formatDate(iso: string): string {
  if (!iso) return ""
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Chicago",
    })
  } catch {
    return iso
  }
}

export default function FeedPreviewPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [item, setItem] = useState<FeedItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/feed-submit?table=THEFEED`, { cache: "no-store" })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || "Failed to load")
        const found = (json.data as FeedItem[]).find((f) => f.id === id)
        if (!found) throw new Error("Feed item not found")
        if (!cancelled) setItem(found)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preview")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const html = useMemo(() => {
    if (!item) return null
    return {
      summary: md(item.summary),
      foundersNote: md(item.founders_note_text),
      featured: md(item.featured_post_content),
      event: md(item.upcoming_event_description),
      s1: md(item.spotlight_1_description),
      s2: md(item.spotlight_2_description),
      s3: md(item.spotlight_3_description),
    }
  }, [item])

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-screen bg-neutral-50">
        {/* Preview banner */}
        <div className="sticky top-0 z-50 bg-neutral-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-[0.18em] font-medium">
              <span className="inline-block h-1 w-1 rounded-full bg-amber-400" aria-hidden="true" />
              Preview
            </span>
            {item && (
              <span className="text-neutral-300 tabular-nums truncate">
                {item.status} · {item.title}
              </span>
            )}
          </div>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md ring-1 ring-white/20 hover:bg-white/10 transition-colors text-xs font-medium"
          >
            <ArrowLeft className="w-3 h-3" />
            Close
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-32 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading preview…
          </div>
        )}

        {error && !isLoading && (
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <p className="text-red-600 text-sm font-medium">{error}</p>
            <p className="text-neutral-500 text-xs mt-2">
              Make sure the item has been saved at least once before previewing.
            </p>
          </div>
        )}

        {item && html && (
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
            {/* Header */}
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                <span>{item.type}</span>
                <span className="text-neutral-300">·</span>
                <Calendar className="w-3 h-3" />
                <span className="tabular-nums">{formatDate(item.published_date)}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-neutral-900">
                {item.title || "Untitled"}
              </h1>
              {item.summary && (
                <div
                  className="prose prose-neutral max-w-none text-neutral-700"
                  dangerouslySetInnerHTML={{ __html: html.summary }}
                />
              )}
              {(item.authors.length > 0 || item.topics.length > 0) && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
                  {item.authors.length > 0 && (
                    <p className="text-neutral-500">
                      <span className="font-medium text-neutral-700">By</span> {item.authors.join(", ")}
                    </p>
                  )}
                  {item.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.topics.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </header>

            {/* Hero */}
            {(item.hero_image_desktop || item.hero_image_mobile) && (
              <figure className="rounded-md overflow-hidden ring-1 ring-neutral-200/70 bg-neutral-100">
                <picture>
                  {item.hero_image_mobile && (
                    <source media="(max-width: 640px)" srcSet={item.hero_image_mobile} />
                  )}
                  <img
                    src={item.hero_image_desktop || item.hero_image_mobile}
                    alt="Hero"
                    className="w-full h-auto block"
                  />
                </picture>
              </figure>
            )}

            {/* Founder's note */}
            {(item.founders_note_text || item.founders_note_image) && (
              <section className="space-y-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Founder's note
                </p>
                <div className="flex flex-col sm:flex-row gap-5">
                  {item.founders_note_image && (
                    <img
                      src={item.founders_note_image}
                      alt="Founder"
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-1 ring-neutral-200 shrink-0"
                    />
                  )}
                  {html.foundersNote && (
                    <div
                      className="prose prose-neutral max-w-none text-neutral-700 flex-1"
                      dangerouslySetInnerHTML={{ __html: html.foundersNote }}
                    />
                  )}
                </div>
              </section>
            )}

            {/* Last Month + The Drop GIFs */}
            {(item.last_month_gif || item.the_drop_gif) && (
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {item.last_month_gif && (
                  <figure className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Last month
                    </p>
                    <img
                      src={item.last_month_gif}
                      alt="Last month"
                      className="w-full rounded-md ring-1 ring-neutral-200/70 bg-neutral-100"
                    />
                  </figure>
                )}
                {item.the_drop_gif && (
                  <figure className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      The drop
                    </p>
                    <img
                      src={item.the_drop_gif}
                      alt="The drop"
                      className="w-full rounded-md ring-1 ring-neutral-200/70 bg-neutral-100"
                    />
                  </figure>
                )}
              </section>
            )}

            {/* Featured post */}
            {(item.featured_post_title || item.featured_post_image || item.featured_post_content) && (
              <section className="space-y-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Featured
                </p>
                {item.featured_post_image && (
                  <img
                    src={item.featured_post_image}
                    alt={item.featured_post_title || "Featured"}
                    className="w-full rounded-md ring-1 ring-neutral-200/70 bg-neutral-100"
                  />
                )}
                {item.featured_post_title && (
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
                    {item.featured_post_title}
                  </h2>
                )}
                {html.featured && (
                  <div
                    className="prose prose-neutral max-w-none text-neutral-700"
                    dangerouslySetInnerHTML={{ __html: html.featured }}
                  />
                )}
              </section>
            )}

            {/* Upcoming event */}
            {(item.upcoming_event_title || item.upcoming_event_description) && (
              <section className="rounded-md ring-1 ring-neutral-200/70 bg-white overflow-hidden">
                {(item.upcoming_event_image_desktop || item.upcoming_event_image_mobile) && (
                  <picture>
                    {item.upcoming_event_image_mobile && (
                      <source media="(max-width: 640px)" srcSet={item.upcoming_event_image_mobile} />
                    )}
                    <img
                      src={item.upcoming_event_image_desktop || item.upcoming_event_image_mobile}
                      alt={item.upcoming_event_title || "Upcoming event"}
                      className="w-full h-auto"
                    />
                  </picture>
                )}
                <div className="p-5 sm:p-6 space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Upcoming event
                  </p>
                  {item.upcoming_event_title && (
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
                      {item.upcoming_event_title}
                    </h2>
                  )}
                  {html.event && (
                    <div
                      className="prose prose-neutral max-w-none text-neutral-700"
                      dangerouslySetInnerHTML={{ __html: html.event }}
                    />
                  )}
                  {item.upcoming_event_cta_text && item.upcoming_event_cta_link && (
                    <a
                      href={item.upcoming_event_cta_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium transition-colors"
                    >
                      {item.upcoming_event_cta_text}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </section>
            )}

            {/* Spotlights */}
            {[
              {
                num: 1,
                title: item.spotlight_1_title,
                desc: html.s1,
                image: item.spotlight_1_image,
                ctaText: item.spotlight_1_cta_text,
                ctaLink: item.spotlight_1_cta_link,
              },
              {
                num: 2,
                title: item.spotlight_2_title,
                desc: html.s2,
                image: item.spotlight_2_image,
                ctaText: item.spotlight_2_cta_text,
                ctaLink: item.spotlight_2_cta_link,
              },
              {
                num: 3,
                title: item.spotlight_3_title,
                desc: html.s3,
                image: item.spotlight_3_image,
                ctaText: item.spotlight_3_cta_text,
                ctaLink: item.spotlight_3_cta_link,
              },
            ]
              .filter((s) => s.title || s.desc || s.image)
              .map((s) => (
                <section
                  key={s.num}
                  className="rounded-md ring-1 ring-neutral-200/70 bg-white overflow-hidden"
                >
                  {s.image && (
                    <img
                      src={s.image}
                      alt={s.title || `Spotlight ${s.num}`}
                      className="w-full h-auto"
                    />
                  )}
                  <div className="p-5 sm:p-6 space-y-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Spotlight {s.num}
                    </p>
                    {s.title && (
                      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{s.title}</h2>
                    )}
                    {s.desc && (
                      <div
                        className="prose prose-neutral max-w-none text-neutral-700"
                        dangerouslySetInnerHTML={{ __html: s.desc }}
                      />
                    )}
                    {s.ctaText && s.ctaLink && (
                      <a
                        href={s.ctaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-medium transition-colors"
                      >
                        {s.ctaText}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </section>
              ))}

            {/* Footer */}
            <footer className="pt-8 border-t border-neutral-200 text-xs text-neutral-400 tabular-nums">
              <p>
                Preview · This is an admin approximation of how this content will appear on{" "}
                <span className="text-neutral-700">digitalcanvas.community/thefeed</span>. Final
                rendering on the public site may differ.
              </p>
            </footer>
          </article>
        )}
      </div>
    </AdminRoleGuard>
  )
}

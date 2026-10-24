import "server-only"
import { Marked } from "marked"
import sanitizeHtml from "sanitize-html"
import { getFeedItems, getFeedItemBySlug, type FeedItem } from "@/lib/firestore-feed"

/**
 * The Feed, as the public pages at /thefeed render it.
 *
 * Until 2026-10 these pages lived on the Digital Canvas site and fetched
 * /api/public/feed over HTTP. They now live here, so they read the same
 * Firestore collection directly (lib/firestore-feed.ts). Only published items
 * are ever returned. Text fields are authored as Markdown or HTML in
 * /admin/feed-form; both are converted and sanitized here, server side, so
 * nothing reaches dangerouslySetInnerHTML unsanitized.
 */

const feedMarked = new Marked({ async: false, gfm: true, breaks: true })

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4",
    "ul", "ol", "li", "blockquote", "code", "pre", "a", "span",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
}

/** An authored link, kept only when it is http, https or mailto. */
function safeHref(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value.trim())
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/** An authored image URL, kept only when it is http or https. */
function safeImage(value: string | undefined): string {
  if (!value) return ""
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""
  } catch {
    return ""
  }
}

function toHtml(text: string | undefined): string {
  if (!text) return ""
  const html = /<[a-z][\s\S]*>/i.test(text) ? text : (feedMarked.parse(text) as string)
  return sanitizeHtml(html, SANITIZE)
}

export type FeedType = FeedItem["type"]

export interface NewsletterContent {
  heroImage: { desktop: string; mobile: string }
  foundersNote: { text: string; image: string }
  lastMonthGif: string
  theDropGif: string
  featuredPost: { title: string; image: string; content: string }
  /** ctaLink is undefined when the authored link is missing or not http(s)/mailto; no CTA renders. */
  spotlights: { title: string; description: string; image: string; ctaText: string; ctaLink?: string }[]
  upcomingEvent: {
    title: string
    description: string
    image: { desktop: string; mobile: string }
    ctaText: string
    ctaLink?: string
  }
}

export interface PublicFeedItem {
  id: string
  slug: string
  title: string
  type: FeedType
  /** Sanitized HTML. */
  summaryHtml: string
  /** Plain text, for metadata and the detail page's standfirst. */
  summaryText: string
  authors: string[]
  topics: string[]
  date: string
  published_date: string
  ogImage: string
  ogTitle?: string
  ogDescription?: string
  newsletterContent?: NewsletterContent
}

function newsletterContent(item: FeedItem): NewsletterContent {
  const spotlights = ([1, 2, 3] as const).map((n) => ({
    title: item[`spotlight_${n}_title`] || "",
    description: toHtml(item[`spotlight_${n}_description`]),
    image: safeImage(item[`spotlight_${n}_image`]),
    ctaText: item[`spotlight_${n}_cta_text`] || "Learn More",
    ctaLink: safeHref(item[`spotlight_${n}_cta_link`]),
  }))
  return {
    heroImage: { desktop: safeImage(item.hero_image_desktop), mobile: safeImage(item.hero_image_mobile) },
    foundersNote: { text: toHtml(item.founders_note_text), image: safeImage(item.founders_note_image) },
    lastMonthGif: safeImage(item.last_month_gif),
    theDropGif: safeImage(item.the_drop_gif),
    featuredPost: {
      title: item.featured_post_title || "",
      image: safeImage(item.featured_post_image),
      content: toHtml(item.featured_post_content),
    },
    spotlights: spotlights.filter((s) => s.title),
    upcomingEvent: {
      title: item.upcoming_event_title || "",
      description: toHtml(item.upcoming_event_description),
      image: {
        desktop: safeImage(item.upcoming_event_image_desktop),
        mobile: safeImage(item.upcoming_event_image_mobile),
      },
      ctaText: item.upcoming_event_cta_text || "Learn More",
      ctaLink: safeHref(item.upcoming_event_cta_link),
    },
  }
}

function toPublic(item: FeedItem): PublicFeedItem {
  const summaryHtml = toHtml(item.summary)
  return {
    id: item.id || item.slug,
    slug: item.slug,
    title: item.title,
    type: item.type,
    summaryHtml,
    summaryText: sanitizeHtml(summaryHtml, { allowedTags: [], allowedAttributes: {} }).trim(),
    authors: item.authors || [],
    topics: item.topics || [],
    date: new Date(item.published_date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Chicago",
    }),
    published_date: item.published_date,
    ogImage: safeImage(item.og_image),
    ogTitle: item.og_title,
    ogDescription: item.og_description,
    newsletterContent: item.type === "newsletter" ? newsletterContent(item) : undefined,
  }
}

/** Published items, newest first. */
export async function getPublicFeedItems(): Promise<PublicFeedItem[]> {
  const items = await getFeedItems({ tableName: "THEFEED", status: "published" })
  return items
    .filter((item) => item.slug)
    .map(toPublic)
    .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
}

/** One published item, or null for a missing, draft, scheduled or archived slug. */
export async function getPublicFeedItem(slug: string): Promise<PublicFeedItem | null> {
  const item = await getFeedItemBySlug(slug, "THEFEED", { status: "published" })
  if (!item || item.status !== "published") return null
  return toPublic(item)
}

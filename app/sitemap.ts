import type { MetadataRoute } from "next"
import { getBlogPostsFromFirestore } from "@/lib/firestore-blog"
import { getProducts } from "@/lib/shopify"
import { getPublicFeedItems } from "@/lib/thefeed"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  // Static pages carry no lastModified. It used to be `new Date()` on every
  // one, so every build told search engines that every page had just changed,
  // which teaches them to ignore the date altogether. A page lists a date only
  // where it is a real one. /events was listed here and returns 404; removed.
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      // Launched 2026-09-29. It was absent from here for as long as it
      // redirected, which was correct then and wrong the moment it went live.
      url: `${baseUrl}/work`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      // Launched 2026-10-14 (434-context#131).
      url: `${baseUrl}/performance-marketing`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/shop`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      // The Feed and Lead with Ops moved here from the Digital Canvas site
      // (founder, 2026-10-24). The Lead with Ops feedback form is noindex and
      // stays out.
      url: `${baseUrl}/thefeed`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/workshops/lead-with-ops`,
      lastModified: new Date("2026-06-18"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/en/sdoh`,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: {
          "en-US": `${baseUrl}/en/sdoh`,
          "es-ES": `${baseUrl}/es/sdoh`,
        },
      },
    },
    {
      url: `${baseUrl}/es/sdoh`,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: {
          "en-US": `${baseUrl}/en/sdoh`,
          "es-ES": `${baseUrl}/es/sdoh`,
        },
      },
    },
  ]

  // Fetch dynamic content (in parallel)
  const [posts, products, feedItems] = await Promise.all([
    getBlogPostsFromFirestore({ status: "published" }).catch(() => []),
    getProducts({}).catch(() => []),
    getPublicFeedItems().catch(() => []),
  ])

  const blogEntries: MetadataRoute.Sitemap = Array.isArray(posts)
    ? posts
        .filter((p) => p.status === "published")
        .map((p) => ({
          url: `${baseUrl}/blog/${p.slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(p.created_at),
          changeFrequency: "monthly",
          priority: 0.6,
        }))
    : []

  const productEntries: MetadataRoute.Sitemap = Array.isArray(products)
    ? products.map((prod) => ({
        url: `${baseUrl}/product/${prod.handle}`,
        ...(prod.updatedAt ? { lastModified: new Date(prod.updatedAt) } : {}),
        changeFrequency: "weekly",
        priority: 0.6,
      }))
    : []

  const feedEntries: MetadataRoute.Sitemap = feedItems.map((item) => ({
    url: `${baseUrl}/thefeed/${item.slug}`,
    lastModified: new Date(item.published_date),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...blogEntries, ...feedEntries, ...productEntries]
}


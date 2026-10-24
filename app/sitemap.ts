import type { MetadataRoute } from "next"
import { getBlogPostsFromFirestore } from "@/lib/firestore-blog"
import { getProducts } from "@/lib/shopify"
import { getPublicFeedItems } from "@/lib/thefeed"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      // Launched 2026-09-29. It was absent from here for as long as it
      // redirected, which was correct then and wrong the moment it went live.
      url: `${baseUrl}/work`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      // Launched 2026-10-14 (434-context#131).
      url: `${baseUrl}/performance-marketing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/shop`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      // The Feed and Lead with Ops moved here from the Digital Canvas site
      // (founder, 2026-10-24). The Lead with Ops feedback form is noindex and
      // stays out.
      url: `${baseUrl}/thefeed`,
      lastModified: new Date(),
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
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/en/sdoh`,
      lastModified: new Date(),
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
      lastModified: new Date(),
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
        .filter((p: any) => p.status === "published")
        .map((p: any) => ({
          url: `${baseUrl}/blog/${p.slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(p.created_at),
          changeFrequency: "monthly",
          priority: 0.6,
        }))
    : []

  const productEntries: MetadataRoute.Sitemap = Array.isArray(products)
    ? products.map((prod: any) => ({
        url: `${baseUrl}/product/${prod.handle}`,
        lastModified: new Date(),
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


import type { MetadataRoute } from "next"
import { getBlogPostsFromFirestore } from "@/lib/firestore-blog"
import { getProducts } from "@/lib/shopify"

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
      url: `${baseUrl}/work`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
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
  ]

  // Fetch dynamic content (in parallel)
  const [posts, products] = await Promise.all([
    getBlogPostsFromFirestore({ status: "published" }).catch(() => []),
    getProducts({}).catch(() => []),
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

  return [...staticEntries, ...blogEntries, ...productEntries]
}


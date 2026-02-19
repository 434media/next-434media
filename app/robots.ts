import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/*", "/admin/*", "/test-meta"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}


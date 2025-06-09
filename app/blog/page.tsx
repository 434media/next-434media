import type { Metadata } from "next"
import { getBlogPosts } from "../lib/blog-db"
import BlogClientPage from "./BlogClientPage"

export const metadata: Metadata = {
  title: "Blog | 434 MEDIA - Creative Media & Smart Marketing Insights",
  description:
    "Discover the latest insights, trends, and strategies in creative media, digital marketing, and business growth from the 434 MEDIA team.",
  keywords: ["blog", "marketing", "creative media", "digital strategy", "business insights", "434 media"],
  openGraph: {
    title: "434 MEDIA Blog - Creative Media & Marketing Insights",
    description:
      "Discover the latest insights, trends, and strategies in creative media, digital marketing, and business growth.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/blog`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/api/og/blog-index`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA Blog",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "434 MEDIA Blog - Creative Media & Marketing Insights",
    description:
      "Discover the latest insights, trends, and strategies in creative media, digital marketing, and business growth.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/api/og/blog-index`],
    creator: "@434media",
    site: "@434media",
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/blog`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default async function BlogPage() {
  try {
    const allPosts = await getBlogPosts()
    const publishedPosts = allPosts.filter((post) => post.status === "published")

    return <BlogClientPage initialPosts={publishedPosts} />
  } catch (error) {
    console.error("Error loading blog posts:", error)
    return <BlogClientPage initialPosts={[]} />
  }
}

import { Suspense } from "react"
import BlogContent from "./BlogClientPage"
import { getBlogPosts } from "../lib/blog-db"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Blog | 434 MEDIA",
  description:
    "Explore the latest insights, news, and updates from 434 MEDIA on creative media and smart marketing solutions.",
  openGraph: {
    title: "Blog | 434 MEDIA",
    description:
      "Explore the latest insights, news, and updates from 434 MEDIA on creative media and smart marketing solutions.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/blog`,
    siteName: "434 MEDIA",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/api/og?title=${encodeURIComponent("434 MEDIA Blog")}&subtitle=${encodeURIComponent("Insights on creative media and smart marketing")}`,
        width: 1200,
        height: 630,
        alt: "434 MEDIA Blog",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | 434 MEDIA",
    description:
      "Explore the latest insights, news, and updates from 434 MEDIA on creative media and smart marketing solutions.",
    images: [
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"}/api/og?title=${encodeURIComponent("434 MEDIA Blog")}&subtitle=${encodeURIComponent("Insights on creative media and smart marketing")}`,
    ],
  },
}

function BlogSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black pt-28 sm:pt-32 lg:pt-36 pb-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-pulse space-y-8 sm:space-y-12">
            <div className="space-y-4 sm:space-y-6">
              <div className="h-12 sm:h-16 lg:h-20 bg-white/20 rounded-lg mx-auto max-w-2xl" />
              <div className="h-6 sm:h-8 bg-white/10 rounded-lg mx-auto max-w-4xl" />
            </div>
            <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 bg-white/20 rounded-full mx-auto" />
          </div>
        </div>
      </div>
      <div className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-40 sm:h-48 bg-gray-200 rounded-xl mb-4" />
                <div className="h-5 sm:h-6 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-4 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function BlogPage() {
  try {
    const posts = await getBlogPosts()

    return (
      <Suspense fallback={<BlogSkeleton />}>
        <BlogContent initialPosts={posts} />
      </Suspense>
    )
  } catch (error) {
    console.error("Error loading blog posts:", error)
    return (
      <Suspense fallback={<BlogSkeleton />}>
        <BlogContent initialPosts={[]} />
      </Suspense>
    )
  }
}

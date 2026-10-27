import type { Metadata } from "next"
import { getBlogPostsFromFirestore } from "@/lib/firestore-blog"
import BlogClientPage from "./BlogClientPage"
import { BRAND } from "@/lib/seo/brand"

// Posts are read from Firestore on every request, so a published or edited post
// appears immediately. The root layout used to force that for every page; it no
// longer does (2b fix 9), so the blog states it.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  // "%s | 434 MEDIA" comes from the title template in app/layout.tsx. The
  // previous absolute title also carried "Creative Media & Smart Marketing",
  // which the master retires from titles and metadata.
  title: "Blog",
  // The description used to sell "creative media, digital marketing, and
  // business growth", agency positioning the master retires (Section 2). It
  // now leads with the 1.1 definition, as /contact's does.
  description: `${BRAND.description} News, stories and field notes from the studio.`,
  keywords: ["434 MEDIA blog", "production studio", "original IP", "San Antonio", "434 media"],
  openGraph: {
    title: "434 MEDIA Blog",
    description: `${BRAND.description} News, stories and field notes from the studio.`,
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
    title: "434 MEDIA Blog",
    description: `${BRAND.description} News, stories and field notes from the studio.`,
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
    console.log("🔍 Loading blog posts from Firestore...")
    const publishedPosts = await getBlogPostsFromFirestore({ status: "published" })
    console.log(`✅ Successfully loaded ${publishedPosts.length} blog posts`)

    return <BlogClientPage initialPosts={publishedPosts} />
  } catch (error) {
    console.error("❌ Error loading blog posts:", error)
    
    // Provide helpful error information
    if (error instanceof Error) {
      console.error("Blog loading error details:", {
        message: error.message,
        name: error.name
      })
    }
    
    return <BlogClientPage initialPosts={[]} />
  }
}

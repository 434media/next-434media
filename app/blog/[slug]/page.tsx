import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getBlogPostBySlug } from "../../lib/blog-db"
import BlogPostPageClient from "./BlogPostPageClient"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    return {
      title: "Blog Post Not Found | 434 MEDIA",
      description: "The requested blog post could not be found.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  // Create OG image URL with proper encoding
  const ogImageParams = new URLSearchParams({
    title: post.title,
    category: post.category || "Blog",
    author: post.author || "434 Media",
    date: new Date(post.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  })

  const ogImageUrl = `${baseUrl}/api/og/blog/${encodeURIComponent(slug)}?${ogImageParams.toString()}`

  // Handle tags properly - they're already an array
  const tagsArray = Array.isArray(post.tags) ? post.tags : []
  const keywordsArray = tagsArray.length > 0 ? tagsArray : ["434 Media", "Blog", "Technology"]

  return {
    title: `${post.title} | 434 MEDIA Blog`,
    description: post.excerpt || "Read this article on the 434 MEDIA blog",
    keywords: keywordsArray,
    authors: [{ name: post.author || "434 Media" }],
    creator: post.author || "434 Media",
    publisher: "434 Media",
    openGraph: {
      title: post.title,
      description: post.excerpt || "Read this article on the 434 MEDIA blog",
      url: `${baseUrl}/blog/${slug}`,
      siteName: "434 MEDIA",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
          type: "image/png",
        },
      ],
      locale: "en_US",
      type: "article",
      publishedTime: post.created_at,
      modifiedTime: post.updated_at || post.created_at,
      section: post.category || "Technology",
      tags: tagsArray,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || "Read this article on the 434 MEDIA blog",
      images: [ogImageUrl],
      creator: "@434media",
      site: "@434media",
    },
    alternates: {
      canonical: `${baseUrl}/blog/${slug}`,
    },
    robots: {
      index: post.status === "published",
      follow: post.status === "published",
      googleBot: {
        index: post.status === "published",
        follow: post.status === "published",
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  // Pass params as a Promise to match the expected type
  return <BlogPostPageClient params={Promise.resolve({ slug })} />
}

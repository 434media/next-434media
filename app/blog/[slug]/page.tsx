import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getBlogPostBySlug } from "../../lib/blog-db"
import BlogPostPageClient from "./BlogPostPageClient"

type Props = {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.slug)

  if (!post) {
    return {
      title: "Blog Post Not Found | 434 MEDIA",
      description: "The requested blog post could not be found.",
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  return {
    title: `${post.title} | 434 MEDIA Blog`,
    description: post.excerpt || "Read this article on the 434 MEDIA blog",
    openGraph: {
      title: post.title,
      description: post.excerpt || "Read this article on the 434 MEDIA blog",
      url: `${baseUrl}/blog/${post.slug}`,
      siteName: "434 MEDIA",
      images: [
        {
          // Use our dynamic OG image generator
          url: `${baseUrl}/api/og/blog/${post.slug}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || "Read this article on the 434 MEDIA blog",
      images: [`${baseUrl}/api/og/blog/${post.slug}`],
    },
    alternates: {
      canonical: `${baseUrl}/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getBlogPostBySlug(params.slug)

  if (!post) {
    notFound()
  }

  return <BlogPostPageClient params={Promise.resolve({ slug: params.slug })} />
}

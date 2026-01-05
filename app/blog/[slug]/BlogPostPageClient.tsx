"use client"

import { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Share2, Copy, X, ExternalLink } from "lucide-react"
import { getBlogPostBySlugAction, getBlogPostsAction } from "@/app/actions/blog"
import BlogCard from "../../components/blog/BlogCard"
import type { BlogPost } from "../../types/blog-types"

interface BlogPostPageProps {
  params: { slug: string }
}

// Custom SVG Icons based on Simple Icons
const TwitterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
)

const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

const LoadingSpinner = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin"></div>
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="text-gray-900 font-medium text-sm">Loading article...</div>
      </div>
    </div>
  </div>
)

export default function BlogPostPageClient({ params }: BlogPostPageProps) {
  const { slug } = params

  const [post, setPost] = useState<BlogPost | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [postResult, relatedResult] = await Promise.all([
          getBlogPostBySlugAction(slug),
          getBlogPostsAction({ status: "published" }),
        ])

        if (!postResult.success || !postResult.post) {
          notFound()
        }

        setPost(postResult.post)

        const posts = relatedResult.success && relatedResult.posts ? relatedResult.posts : []
        const filtered = posts
          .filter((p) => p.id !== postResult.post!.id && p.category === postResult.post!.category)
          .slice(0, 3)

        setRelatedPosts(filtered)
      } catch (error) {
        console.error("Error loading blog post:", error)
        notFound()
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [slug])

  // Reading progress tracker
  useEffect(() => {
    const updateReadingProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (scrollTop / docHeight) * 100
      setReadingProgress(Math.min(100, Math.max(0, progress)))
    }

    window.addEventListener("scroll", updateReadingProgress)
    return () => window.removeEventListener("scroll", updateReadingProgress)
  }, [])

  // Process external links to add Lucide React icons
  useEffect(() => {
    if (!post?.content) return

    const blogContent = document.querySelector('.blog-content')
    if (!blogContent) return

    const externalLinks = blogContent.querySelectorAll('a[href^="http"]:not([href*="434media.com"])')
    
    externalLinks.forEach((link) => {
      // Check if icon already added
      if (link.querySelector('.external-link-icon')) return

      // Create icon wrapper
      const iconWrapper = document.createElement('span')
      iconWrapper.className = 'external-link-icon inline-flex items-center ml-1'
      iconWrapper.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60">
          <path d="m7 17 10-10"></path>
          <path d="M17 7H7v10"></path>
        </svg>
      `
      
      // Append icon to link
      link.appendChild(iconWrapper)
    })
  }, [post?.content])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getCategoryColor = (category: string) => {
    return "bg-gray-900 text-white"
  }

  const handleShare = async (platform: string) => {
    if (!post) return

    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = post.title
    const text = post.excerpt || title

    try {
      switch (platform) {
        case "twitter":
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=434Media`,
            "_blank",
            "width=550,height=420,scrollbars=yes,resizable=yes",
          )
          break
        case "linkedin":
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
            "_blank",
            "width=550,height=420,scrollbars=yes,resizable=yes",
          )
          break
        case "copy":
          await navigator.clipboard.writeText(url)
          setCopySuccess(true)
          setTimeout(() => setCopySuccess(false), 3000)
          break
      }
    } catch (error) {
      console.error("Error sharing:", error)
    }

    setShowShareModal(false)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!post) {
    notFound()
  }

  return (
    <>
      <div className="fixed top-0 left-0 w-full h-0.5 bg-gray-200 z-40">
        <div
          className="h-full bg-gray-900 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="min-h-screen bg-white">
        <header className="relative bg-white border-b border-gray-100">
          <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-10 sm:pb-12">
            {/* Back Button */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors duration-200 mb-10 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium tracking-wide">Back to Blog</span>
            </Link>

            {/* Category Badge */}
            <div className="mb-5">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getCategoryColor(post.category)}`}
              >
                {post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-[1.15] mb-6 tracking-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-10 font-normal max-w-2xl">
                {post.excerpt}
              </p>
            )}

            {/* Meta Info with Share Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 pt-6 border-t border-gray-100">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="font-semibold text-gray-900">{post.author}</span>
                <span className="text-gray-300">·</span>
                <time dateTime={post.published_at || post.created_at}>
                  {formatDate(post.published_at || post.created_at)}
                </time>
                {post.read_time && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>{post.read_time} min read</span>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </header>

        {/* Featured Image - Natural Aspect Ratio */}
        {post.featured_image && (
          <section className="relative pt-8 md:pt-12">
            <div className="max-w-4xl mx-auto px-6">
              <figure className="relative">
                <Image
                  src={post.featured_image || "/placeholder.svg"}
                  alt={post.title}
                  width={1200}
                  height={800}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 896px"
                  className={`w-full h-auto rounded-lg transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  priority
                  onLoad={() => setImageLoaded(true)}
                />
              </figure>
            </div>
          </section>
        )}

        {/* Article Content */}
        <main className="relative">
          <div className="max-w-3xl mx-auto px-6 mb-20">
            <article>
              <div className="py-10 sm:py-14">
                {/* Content */}
            <div
                className={`
                blog-content
                prose prose-lg max-w-none
                prose-headings:text-gray-900 prose-headings:font-bold prose-headings:tracking-tight prose-headings:leading-tight
                prose-p:text-gray-700 prose-p:leading-[1.8] prose-p:text-[17px] prose-p:mb-7 prose-p:font-normal
                prose-strong:text-gray-900 prose-strong:font-bold
                prose-em:text-gray-700 prose-em:italic
                prose-ul:text-gray-700 prose-ul:leading-[1.8] prose-li:text-gray-700 prose-li:text-[17px] prose-li:mb-2
                prose-ol:text-gray-700 prose-ol:leading-[1.8]
                prose-blockquote:text-gray-600 prose-blockquote:border-l-[3px] prose-blockquote:border-gray-900 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:font-normal prose-blockquote:text-lg prose-blockquote:leading-relaxed prose-blockquote:my-10
                prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:my-8
                prose-img:rounded-lg prose-img:my-10
                prose-a:text-gray-900 prose-a:font-semibold prose-a:underline prose-a:decoration-gray-300 prose-a:underline-offset-3 hover:prose-a:decoration-gray-900 prose-a:transition-colors
                prose-hr:border-gray-200 prose-hr:my-12
                prose-table:border-collapse prose-thead:bg-gray-50 prose-th:border prose-th:border-gray-200 prose-th:p-4 prose-th:text-left prose-th:font-semibold prose-td:border prose-td:border-gray-200 prose-td:p-4
                prose-h1:text-3xl sm:prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-14 prose-h1:font-extrabold
                prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mb-5 prose-h2:mt-14 prose-h2:font-bold
                prose-h3:text-xl sm:prose-h3:text-2xl prose-h3:mb-4 prose-h3:mt-10 prose-h3:font-bold
                prose-h4:text-lg sm:prose-h4:text-xl prose-h4:mb-4 prose-h4:mt-8 prose-h4:font-semibold
                prose-h5:text-base prose-h5:mb-3 prose-h5:mt-6 prose-h5:font-semibold
                prose-h6:text-sm prose-h6:mb-3 prose-h6:mt-6 prose-h6:font-semibold prose-h6:uppercase prose-h6:tracking-wider prose-h6:text-gray-500
                prose-figure:my-10
            `.replace(/\s+/g, ' ').trim()}
                dangerouslySetInnerHTML={{ __html: post.content }}
            />
                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-14 pt-10 border-t border-gray-200">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Tagged</h4>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          </div>
        </main>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="py-20 bg-gray-50 border-t border-gray-100">
            <div className="max-w-6xl mx-auto px-6">
              <div className="mb-14">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 tracking-tight">Related Articles</h2>
                <p className="text-gray-500 text-base sm:text-lg">Continue exploring our insights</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {relatedPosts.map((relatedPost) => (
                  <BlogCard key={relatedPost.id} post={relatedPost} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  Share Article
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleShare("twitter")}
                  className="w-full flex items-center gap-3 p-3 bg-black hover:bg-gray-800 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <TwitterIcon />
                  Share on X (Twitter)
                </button>

                <button
                  onClick={() => handleShare("linkedin")}
                  className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <LinkedInIcon />
                  Share on LinkedIn
                </button>

                <button
                  onClick={() => handleShare("copy")}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-sm font-medium ${
                    copySuccess ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  {copySuccess ? "Link Copied! ✓" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

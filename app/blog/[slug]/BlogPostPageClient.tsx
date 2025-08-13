"use client"

import { use, useState, useEffect } from "react"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Calendar, Clock, Eye, User, Tag, ArrowLeft, Share2, Copy, X, Heart, Bookmark } from "lucide-react"
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

// Enhanced Loading Component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 flex items-center justify-center">
    <div className="relative">
      {/* Animated rings */}
      <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping"></div>
      <div className="relative w-16 h-16 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full animate-pulse"></div>
      </div>

      {/* Loading text */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="text-purple-600 font-medium text-sm animate-pulse">Loading article...</div>
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
  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
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

        // Safe handling of related posts with proper null checks
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      technology: "bg-blue-50 text-blue-700 border-blue-200 ring-blue-100",
      marketing: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100",
      events: "bg-purple-50 text-purple-700 border-purple-200 ring-purple-100",
      business: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",
      medical: "bg-red-50 text-red-700 border-red-200 ring-red-100",
      science: "bg-cyan-50 text-cyan-700 border-cyan-200 ring-cyan-100",
      robotics: "bg-orange-50 text-orange-700 border-orange-200 ring-orange-100",
      military: "bg-slate-50 text-slate-700 border-slate-200 ring-slate-100",
      "txmx boxing": "bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-100",
      community: "bg-pink-50 text-pink-700 border-pink-200 ring-pink-100",
    }
    return colors[category.toLowerCase()] || "bg-slate-50 text-slate-700 border-slate-200 ring-slate-100"
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
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-slate-200 z-40">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
        {/* Floating Background Elements - Using Tailwind animation classes */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse [animation-delay:2s]"></div>
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse [animation-delay:4s]"></div>
        </div>

        {/* Hero Section */}
        <header className="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden mt-6 md:mt-0">
          {/* Hero Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg fill%3D%22none%22 fillRule%3D%22evenodd%22%3E%3Cg fill%3D%22%23ffffff%22 fillOpacity%3D%220.1%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
          </div>

          <div className="relative max-w-4xl mx-auto px-6 pt-24 sm:pt-32 lg:pt-40 pb-16 lg:pb-24">
            {/* Back Button */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-purple-200 hover:text-white transition-all duration-300 mb-8 group backdrop-blur-sm bg-white/10 px-4 py-2 rounded-xl border border-white/20 hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Insights</span>
            </Link>

            {/* Category Badge */}
            <div className="mb-6">
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border backdrop-blur-sm shadow-lg ring-1 ${getCategoryColor(post.category)}`}
              >
                <Tag className="w-4 h-4 mr-2" />
                {post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
              {post.title}
            </h1>

            {/* Excerpt */}
            {post.excerpt && (
              <p className="text-lg sm:text-xl text-purple-100 leading-relaxed mb-8 max-w-3xl font-light">
                {post.excerpt}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-purple-200 mb-8">
              <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                <User className="w-4 h-4" />
                <span className="font-medium text-sm">{post.author}</span>
              </div>
              <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDate(post.published_at || post.created_at)}</span>
              </div>
              {post.read_time && (
                <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{post.read_time} min read</span>
                </div>
              )}
              <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-2 rounded-lg border border-white/20">
                <Eye className="w-4 h-4" />
                <span className="text-sm">{post.view_count} views</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-medium"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  isLiked
                    ? "bg-red-500 text-white shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
              </button>

              <button
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                  isBookmarked
                    ? "bg-yellow-500 text-white shadow-lg"
                    : "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                }`}
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {post.featured_image && (
          <section className="relative -mt-16 mb-16 z-10">
            <div className="max-w-6xl mx-auto px-6">
              <div className="relative h-64 sm:h-80 lg:h-[32rem] rounded-2xl overflow-hidden shadow-2xl group mt-6 md:mt-0">
                <Image
                  src={post.featured_image || "/placeholder.svg"}
                  alt={post.title}
                  fill
                  style={{ objectFit: "cover" }}
                  className={`object-cover transition-all duration-700 ${imageLoaded ? "scale-100 opacity-100" : "scale-105 opacity-0"}`}
                  priority
                  onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          </section>
        )}

        {/* Article Content */}
        <main className="relative z-10">
          <div className="max-w-4xl mx-auto px-6 mb-16">
            <article className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
              <div className="p-8 lg:p-12">
                {/* Content */}
                <div
                  className="prose prose-lg prose-slate max-w-none 
                    prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight
                    prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8
                    prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-8
                    prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-6
                    prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-6
                    prose-a:text-purple-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-slate-900 prose-strong:font-semibold
                    prose-em:text-slate-600
                    prose-blockquote:border-l-4 prose-blockquote:border-purple-500 prose-blockquote:bg-purple-50 prose-blockquote:p-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                    prose-code:bg-slate-100 prose-code:text-purple-800 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                    prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-4
                    prose-img:rounded-lg prose-img:shadow-lg prose-img:border prose-img:border-slate-200
                    prose-ul:space-y-2 prose-ol:space-y-2
                    prose-li:text-slate-700
                    prose-table:border-collapse prose-table:border prose-table:border-slate-200
                    prose-th:bg-slate-50 prose-th:border prose-th:border-slate-200 prose-th:p-3
                    prose-td:border prose-td:border-slate-200 prose-td:p-3"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {post.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 hover:from-purple-100 hover:to-blue-100 transition-all duration-300 cursor-pointer transform hover:scale-105 shadow-sm hover:shadow-md border border-purple-200"
                        >
                          #{tag}
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
          <section className="py-16 bg-white/50 backdrop-blur-sm border-t border-white/20">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Related Articles</h2>
                <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded-full" />
                <p className="text-slate-600 mt-4 text-lg">Discover more insights from our ecosystem</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedPosts.map((relatedPost, index) => (
                  <div key={relatedPost.id} className="transform transition-all duration-500 hover:scale-105">
                    <BlogCard post={relatedPost} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  Share Article
                </h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleShare("twitter")}
                  className="w-full flex items-center gap-3 p-4 bg-black hover:bg-slate-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <TwitterIcon />
                  Share on X (Twitter)
                </button>

                <button
                  onClick={() => handleShare("linkedin")}
                  className="w-full flex items-center gap-3 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <LinkedInIcon />
                  Share on LinkedIn
                </button>

                <button
                  onClick={() => handleShare("copy")}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${
                    copySuccess ? "bg-green-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                  }`}
                >
                  <Copy className="w-5 h-5" />
                  {copySuccess ? "Link Copied! ✓" : "Copy Link"}
                </button>
              </div>

              <div className="mt-4 text-center text-sm text-slate-500">
                Help spread the word about 434 Media's insights
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

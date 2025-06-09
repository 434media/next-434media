"use client"

import { use, useState, useEffect } from "react"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Calendar, Clock, Eye, User, Tag, ArrowLeft, Share2, Copy, X } from "lucide-react"
import { getBlogPostBySlugAction, getBlogPostsAction } from "@/app/actions/blog"
import BlogCard from "../../components/blog/BlogCard"
import type { BlogPost } from "../../types/blog-types"

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
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

// Loading Component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
    <div className="relative">
      {/* Outer spinning ring */}
      <div className="animate-spin rounded-full h-32 w-32 border-4 border-purple-200"></div>
      <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-purple-600 absolute top-0 left-0"></div>

      {/* Inner content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-600 rounded-full animate-pulse mb-2 mx-auto"></div>
          <div className="text-purple-600 font-medium text-sm">Loading Article...</div>
        </div>
      </div>

      {/* Floating dots */}
      <div className="absolute -top-2 -left-2 w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
      <div className="absolute -top-2 -right-2 w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-200"></div>
      <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-indigo-400 rounded-full animate-bounce animation-delay-400"></div>
      <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-purple-400 rounded-full animate-bounce animation-delay-600"></div>
    </div>
  </div>
)

export default function BlogPostPageClient({ params }: BlogPostPageProps) {
  // Unwrap params using React.use()
  const { slug } = use(params)

  const [post, setPost] = useState<BlogPost | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      technology: "bg-blue-100 text-blue-800 border-blue-200 shadow-blue-100",
      marketing: "bg-green-100 text-green-800 border-green-200 shadow-green-100",
      events: "bg-purple-100 text-purple-800 border-purple-200 shadow-purple-100",
      business: "bg-amber-100 text-amber-800 border-amber-200 shadow-amber-100",
      medical: "bg-red-100 text-red-800 border-red-200 shadow-red-100",
      science: "bg-cyan-100 text-cyan-800 border-cyan-200 shadow-cyan-100",
      robotics: "bg-orange-100 text-orange-800 border-orange-200 shadow-orange-100",
      military: "bg-gray-100 text-gray-800 border-gray-200 shadow-gray-100",
      "txmx boxing": "bg-yellow-100 text-yellow-800 border-yellow-200 shadow-yellow-100",
      community: "bg-pink-100 text-pink-800 border-pink-200 shadow-pink-100",
    }
    return colors[category.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200 shadow-gray-100"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-24 sm:pt-28 lg:pt-32 pb-16 overflow-hidden">
        {/* Hero Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg fill%3D%22none%22 fillRule%3D%22evenodd%22%3E%3Cg fill%3D%22%23ffffff%22 fillOpacity%3D%220.1%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Back Button */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-purple-200 hover:text-white transition-all duration-300 mb-8 group backdrop-blur-sm bg-white/10 px-4 py-2 rounded-lg border border-white/20"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to News & Insights
          </Link>

          {/* Category Badge */}
          <div className="mb-6">
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm shadow-lg ${getCategoryColor(post.category)}`}
            >
              <Tag className="w-4 h-4 mr-2" />
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 animate-in slide-in-from-bottom-4 duration-700">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-lg sm:text-xl text-purple-100 leading-relaxed mb-8 max-w-3xl animate-in slide-in-from-bottom-4 duration-700 delay-200">
              {post.excerpt}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-purple-200 animate-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-1 rounded-lg">
              <User className="w-5 h-5" />
              <span className="font-medium">{post.author}</span>
            </div>
            <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-1 rounded-lg">
              <Calendar className="w-5 h-5" />
              <span className="text-sm sm:text-base">{formatDate(post.published_at || post.created_at)}</span>
            </div>
            {post.read_time && (
              <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-1 rounded-lg">
                <Clock className="w-5 h-5" />
                <span className="text-sm sm:text-base">{post.read_time} min read</span>
              </div>
            )}
            <div className="flex items-center gap-2 backdrop-blur-sm bg-white/10 px-3 py-1 rounded-lg">
              <Eye className="w-5 h-5" />
              <span className="text-sm sm:text-base">{post.view_count} views</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {post.featured_image && (
        <section className="relative -mt-8 mb-16 animate-in slide-in-from-bottom-4 duration-700 delay-600">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative h-64 sm:h-80 lg:h-96 rounded-2xl overflow-hidden shadow-2xl group">
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
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 sm:p-8 lg:p-12 animate-in slide-in-from-bottom-4 duration-700 delay-800">
          {/* Share Button */}
          <div className="flex justify-end mb-8">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Share2 className="w-4 h-4" />
              Share Article
            </button>
          </div>

          {/* Content */}
          <div
            className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-purple-600 prose-strong:text-gray-900 prose-img:rounded-lg prose-img:shadow-lg prose-blockquote:border-purple-500 prose-code:bg-purple-50 prose-code:text-purple-800"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-3">
                {post.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 hover:from-purple-200 hover:to-blue-200 transition-all duration-300 cursor-pointer transform hover:scale-105 shadow-sm hover:shadow-md"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 animate-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Related Articles</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded-full" />
              <p className="text-gray-600 mt-4">Discover more insights from our ecosystem</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost, index) => (
                <div
                  key={relatedPost.id}
                  className="animate-in slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <BlogCard post={relatedPost} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
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
                className="w-full flex items-center gap-3 p-4 bg-black hover:bg-gray-800 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
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
                  copySuccess ? "bg-green-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                }`}
              >
                <Copy className="w-5 h-5" />
                {copySuccess ? "Link Copied! ✓" : "Copy Link"}
              </button>
            </div>

            <div className="mt-4 text-center text-sm text-gray-500">
              Help spread the word about 434 Media's insights
            </div>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
        .animation-delay-600 {
          animation-delay: 600ms;
        }
      `}</style>
    </div>
  )
}

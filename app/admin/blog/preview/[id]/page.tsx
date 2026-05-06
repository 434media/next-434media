"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { Marked } from "marked"
import { ArrowLeft, Calendar, Loader2, Tag, User, Clock } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import type { BlogPost } from "@/types/blog-types"

const previewMarked = new Marked({ async: false, gfm: true, breaks: true })

function md(value: string | undefined): string {
  if (!value) return ""
  try {
    return previewMarked.parse(value) as string
  } catch {
    return value.replace(/\n/g, "<br />")
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Chicago",
    })
  } catch {
    return iso
  }
}

export default function BlogPreviewPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [post, setPost] = useState<BlogPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/blog/${id}`, { cache: "no-store" })
        if (!res.ok) {
          // Fallback: fetch all and find by id (some APIs prefer this)
          const all = await fetch(`/api/blog?includeAll=true`, { cache: "no-store" })
          if (!all.ok) throw new Error("Failed to load post")
          const data = await all.json()
          const found = (data.posts as BlogPost[]).find((p) => p.id === id)
          if (!found) throw new Error("Post not found")
          if (!cancelled) setPost(found)
        } else {
          const json = await res.json()
          const data = (json.post ?? json) as BlogPost
          if (!cancelled) setPost(data)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preview")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const html = useMemo(() => md(post?.content), [post?.content])

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-screen bg-neutral-50">
        {/* Preview banner */}
        <div className="sticky top-0 z-50 bg-neutral-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-[0.18em] font-medium">
              <span className="inline-block h-1 w-1 rounded-full bg-amber-400" aria-hidden="true" />
              Preview
            </span>
            {post && (
              <span className="text-neutral-300 tabular-nums truncate">
                {post.status} · {post.title}
              </span>
            )}
          </div>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md ring-1 ring-white/20 hover:bg-white/10 transition-colors text-xs font-medium"
          >
            <ArrowLeft className="w-3 h-3" />
            Close
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-32 text-neutral-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading preview…
          </div>
        )}

        {error && !isLoading && (
          <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <p className="text-red-600 text-sm font-medium">{error}</p>
            <p className="text-neutral-500 text-xs mt-2">
              Make sure the post has been saved at least once before previewing.
            </p>
          </div>
        )}

        {post && (
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            {/* Header */}
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                <Tag className="w-3 h-3" />
                <span>{post.category}</span>
                <span className="text-neutral-300">·</span>
                <Calendar className="w-3 h-3" />
                <span className="tabular-nums">{formatDate(post.published_at || post.created_at)}</span>
                {post.read_time && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <Clock className="w-3 h-3" />
                    <span className="tabular-nums">{post.read_time} min read</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-neutral-900">
                {post.title || "Untitled"}
              </h1>
              {post.excerpt && (
                <p className="text-lg text-neutral-600 leading-relaxed">{post.excerpt}</p>
              )}
              <div className="flex items-center gap-2 pt-2 text-xs text-neutral-500">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>{post.author}</span>
              </div>
            </header>

            {/* Featured image */}
            {post.featured_image && (
              <figure className="rounded-md overflow-hidden ring-1 ring-neutral-200/70 bg-neutral-100">
                <img src={post.featured_image} alt={post.title} className="w-full h-auto block" />
              </figure>
            )}

            {/* Body */}
            {html && (
              <div
                className="prose prose-neutral max-w-none text-neutral-700
                  prose-headings:text-neutral-900 prose-strong:text-neutral-900
                  prose-a:text-blue-600 prose-a:underline
                  prose-code:bg-neutral-100 prose-code:rounded prose-code:px-1
                  prose-pre:bg-neutral-900 prose-pre:text-neutral-100
                  prose-blockquote:border-neutral-300 prose-blockquote:text-neutral-600"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="pt-6 border-t border-neutral-200">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="pt-6 border-t border-neutral-200 text-xs text-neutral-400 tabular-nums">
              <p>
                Preview · This is an admin approximation of how this post will appear at{" "}
                <span className="text-neutral-700">/blog/{post.slug}</span>. Final rendering on the
                public site may differ.
              </p>
            </footer>
          </article>
        )}
      </div>
    </AdminRoleGuard>
  )
}

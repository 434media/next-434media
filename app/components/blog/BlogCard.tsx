"use client"

import { useState } from "react"
import SmartImage from "@/app/components/SmartImage"
import Link from "next/link"
import { Clock, Eye, User } from "lucide-react"
import type { BlogPost } from "../../types/blog-types"

interface BlogCardProps {
  post: BlogPost
  featured?: boolean
}

export default function BlogCard({ post, featured = false }: BlogCardProps) {
  const [imageError, setImageError] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-all duration-300">
        <Link href={`/blog/${post.slug}`} className="block">
          <div className="relative h-96 overflow-hidden">
            {post.featured_image && !imageError ? (
              <SmartImage
                src={post.featured_image || "/placeholder.svg"}
                alt={post.title}
                fill
                sizes="(min-width:1024px) 800px, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="text-gray-400 text-6xl font-bold opacity-20">434</div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-white/90 text-gray-900 backdrop-blur-sm">
                {post.category}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-white/90 text-gray-900 backdrop-blur-sm">
                {formatDate(post.published_at || post.created_at)}
              </span>
            </div>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 line-clamp-2 leading-tight">{post.title}</h2>
              {post.excerpt && (
                <p className="text-sm sm:text-base text-gray-200 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-300">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{post.author}</span>
                </div>
                {post.read_time && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{post.read_time} min read</span>
                  </div>
                )}
          
              </div>
            </div>
          </div>
        </Link>
      </article>
    )
  }

  return (
    <article className="group bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-300 overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative h-48 overflow-hidden">
          {post.featured_image && !imageError ? (
            <SmartImage
              src={post.featured_image || "/placeholder.svg"}
              alt={post.title}
              fill
              sizes="(min-width:1024px) 400px, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="text-gray-400 text-4xl font-bold opacity-20">434</div>
            </div>
          )}

          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white/90 text-gray-900 backdrop-blur-sm">
              {post.category}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white/90 text-gray-900 backdrop-blur-sm">
              {formatDate(post.published_at || post.created_at)}
            </span>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug group-hover:text-gray-700 transition-colors">
            {post.title}
          </h3>

          {post.excerpt && <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>{post.author}</span>
            </div>
            {post.read_time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{post.read_time} min</span>
              </div>
            )}
       
          </div>
        </div>
      </Link>
    </article>
  )
}

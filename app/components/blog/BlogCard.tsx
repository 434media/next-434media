"use client"

import { useState } from "react"
import SmartImage from "@/app/components/SmartImage"
import Link from "next/link"
import { Clock, User } from "lucide-react"
import type { BlogPost } from "../../types/blog-types"

interface BlogCardProps {
  post: BlogPost
}

export default function BlogCard({ post }: BlogCardProps) {
  const [imageError, setImageError] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <article className="group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
      <Link href={`/blog/${post.slug}`} className="flex flex-col h-full">
        {/* 4:5 Aspect Ratio Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
          {post.featured_image && !imageError ? (
            <SmartImage
              src={post.featured_image || "/placeholder.svg"}
              alt={post.title}
              fill
              sizes="(min-width:1024px) 400px, (min-width:640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <div className="text-gray-400 text-5xl font-bold opacity-20">434</div>
            </div>
          )}

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white/95 text-gray-900 backdrop-blur-sm shadow-sm">
              {post.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug group-hover:text-gray-700 transition-colors tracking-tight">
            {post.title}
          </h3>

          {post.excerpt && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed font-normal flex-grow">
              {post.excerpt}
            </p>
          )}

          {/* Author and Date Row at Bottom */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100 mt-auto">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium text-gray-700">{post.author}</span>
            </div>
            <div className="flex items-center gap-3">
              {post.read_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{post.read_time} min</span>
                </div>
              )}
              <span className="text-gray-400">·</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}

"use client"

import { useState } from "react"
import Image from "next/image"
import SmartImage from "@/app/components/SmartImage"
import Link from "next/link"
import { Calendar, Clock, Eye, User, Tag } from "lucide-react"
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
      month: "long",
      day: "numeric",
    })
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      technology: "bg-blue-100 text-blue-800 border-blue-200",
      marketing: "bg-green-100 text-green-800 border-green-200",
      events: "bg-purple-100 text-purple-800 border-purple-200",
      business: "bg-amber-100 text-amber-800 border-amber-200",
      local: "bg-emerald-100 text-emerald-800 border-emerald-200",
      medical: "bg-red-100 text-red-800 border-red-200",
      science: "bg-cyan-100 text-cyan-800 border-cyan-200",
      robotics: "bg-indigo-100 text-indigo-800 border-indigo-200",
      military: "bg-gray-100 text-gray-800 border-gray-200",
      boxing: "bg-orange-100 text-orange-800 border-orange-200",
    }
    return colors[category.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  if (featured) {
    return (
      <article className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
        <Link href={`/blog/${post.slug}`} className="block">
          <div className="relative h-80 overflow-hidden">
            {post.featured_image && !imageError ? (
              <SmartImage
                src={post.featured_image || "/placeholder.svg"}
                alt={post.title}
                fill
                sizes="(min-width:1024px) 800px, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center relative overflow-hidden">
                <div className="text-white text-6xl font-bold opacity-20">434</div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-transparent to-blue-600/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Category Badge */}
            <div className="absolute top-4 left-4">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border backdrop-blur-sm ${getCategoryColor(post.category)}`}
              >
                <Tag className="w-3 h-3 mr-1" />
                {post.category}
              </span>
            </div>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h2 className="text-2xl font-bold mb-2 line-clamp-2 group-hover:text-yellow-300 transition-colors">
                {post.title}
              </h2>
              {post.excerpt && <p className="text-gray-200 line-clamp-2 mb-4">{post.excerpt}</p>}

              <div className="flex items-center gap-4 text-sm text-gray-300">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {post.author}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.published_at || post.created_at)}
                </div>
                {post.read_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.read_time} min read
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {post.view_count}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </article>
    )
  }

  return (
    <article className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden transform hover:-translate-y-1">
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
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500 flex items-center justify-center relative overflow-hidden">
              <div className="text-white text-4xl font-bold opacity-20">434</div>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-transparent to-purple-600/20" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${getCategoryColor(post.category)}`}
            >
              {post.category}
            </span>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
            {post.title}
          </h3>

          {post.excerpt && <p className="text-gray-600 line-clamp-3 mb-4">{post.excerpt}</p>}

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {post.author}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(post.published_at || post.created_at)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {post.read_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {post.read_time}m
                </div>
              )}
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {post.view_count}
              </div>
            </div>
          </div>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  #{tag}
                </span>
              ))}
              {post.tags.length > 3 && <span className="text-xs text-gray-500">+{post.tags.length - 3} more</span>}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}

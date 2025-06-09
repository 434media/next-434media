"use client"

import { useState, useEffect } from "react"
import { BookOpen } from "lucide-react"
import { getBlogCategoriesAction } from "@/app/actions/blog"
import BlogCard from "../components/blog/BlogCard"
import ScrollSpinLogo from "../components/blog/ScrollSpinLogo"
import type { BlogPost, BlogCategory } from "../types/blog-types"

interface BlogContentProps {
  initialPosts: BlogPost[]
}

export default function BlogContent({ initialPosts }: BlogContentProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>(initialPosts)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoading(true)
        const categoriesResult = await getBlogCategoriesAction()
        const categoriesData = categoriesResult.success ? categoriesResult.categories || [] : []
        setCategories(categoriesData)
      } catch (error) {
        console.error("Error loading blog categories:", error)
      } finally {
        setLoading(false)
      }
    }

    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      const filtered = posts.filter((post) => post.category === selectedCategory)
      setFilteredPosts(filtered)
    } else {
      setFilteredPosts(posts)
    }
  }, [selectedCategory, posts])

  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null
  const recentPosts = filteredPosts.length > 1 ? filteredPosts.slice(1, 7) : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Maximized Space */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black pt-28 sm:pt-32 lg:pt-36 pb-20 sm:pb-24 lg:pb-32 overflow-hidden">
        {/* Sophisticated 434 Media Logo Pattern with Enhanced Contrast */}
        <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0 sm:bg-[length:140px_140px]"
            style={{
              backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
              backgroundSize: "80px 80px",
              backgroundRepeat: "repeat",
              backgroundPosition: "0 0",
              animation: "float 25s ease-in-out infinite",
              filter: "brightness(1.2) contrast(1.1)",
            }}
          />
        </div>

        {/* Enhanced Floating Elements with Green/Blue/Purple */}
        <div className="absolute top-16 sm:top-20 left-4 sm:left-10 w-20 h-20 sm:w-24 sm:h-24 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute top-32 sm:top-40 right-8 sm:right-20 w-32 h-32 sm:w-40 sm:h-40 bg-blue-400/25 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-16 sm:bottom-20 left-1/4 w-24 h-24 sm:w-28 sm:h-28 bg-purple-400/20 rounded-full blur-2xl animate-pulse delay-500" />
        <div className="absolute top-24 sm:top-32 right-1/4 w-16 h-16 sm:w-20 sm:h-20 bg-teal-400/25 rounded-full blur-xl animate-pulse delay-700" />

        {/* Additional floating elements */}
        <div className="absolute top-1/2 left-8 w-12 h-12 sm:w-16 sm:h-16 bg-cyan-400/20 rounded-full blur-lg animate-pulse delay-300" />
        <div className="absolute bottom-1/3 right-12 w-14 h-14 sm:w-18 sm:h-18 bg-indigo-400/25 rounded-full blur-lg animate-pulse delay-900" />
        <div className="absolute top-3/4 left-1/3 w-10 h-10 sm:w-14 sm:h-14 bg-green-400/20 rounded-full blur-lg animate-pulse delay-1200" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] space-y-8 sm:space-y-12">
            {/* Maximized Title and Description */}
            <div className="space-y-6 sm:space-y-8 max-w-5xl mt-10 md:mt-0">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-white leading-tight drop-shadow-2xl">
                <span className="bg-gradient-to-r from-white via-emerald-200 to-blue-200 bg-clip-text text-transparent">
                  News & Insights
                </span>
              </h1>

              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-200 leading-relaxed font-medium drop-shadow-lg max-w-3xl mx-auto">
                Your destination for insights from the <span className="text-white font-semibold">434 Media team</span>,
                our <span className="text-emerald-300 font-semibold">local partners</span>, and our diverse ecosystem.
              </p>
            </div>

            {/* Spinning 434 Logo - Larger Size */}
            <div className="py-6 sm:py-8 lg:py-10 transform scale-125 sm:scale-150 md:mt-6">
              <ScrollSpinLogo />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Interactive Categories Filter */}
          <div className="mb-12 sm:mb-16">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Explore by Category</h2>
              <p className="text-sm sm:text-base text-gray-600">Filter content across our diverse ecosystem</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all transform hover:scale-105 shadow-lg ${
                  selectedCategory === null
                    ? "bg-gradient-to-r from-emerald-600 to-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md"
                }`}
              >
                All News & Insights ({posts.length})
              </button>
              {categories &&
                categories.length > 0 &&
                categories.map((category) => (
                  <button
                    key={category.slug}
                    onClick={() => setSelectedCategory(category.slug)}
                    className={`px-4 py-2 sm:px-6 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all transform hover:scale-105 ${
                      selectedCategory === category.slug
                        ? "bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md"
                    }`}
                  >
                    {category.name} ({category.post_count || 0})
                  </button>
                ))}
            </div>

            {/* Filter Results Indicator */}
            {selectedCategory && (
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Showing {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
                  {selectedCategory &&
                    categories.find((cat) => cat.slug === selectedCategory) &&
                    ` in "${categories.find((cat) => cat.slug === selectedCategory)?.name}"`}
                </p>
              </div>
            )}
          </div>

          {/* Featured Post */}
          {featuredPost && (
            <div className="mb-12 sm:mb-16">
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  {selectedCategory ? "Top Story" : "Featured Story"}
                </h2>
                <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-emerald-600 to-blue-600 mx-auto rounded-full" />
              </div>
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Recent Posts */}
          {recentPosts && recentPosts.length > 0 && (
            <div>
              <div className="text-center mb-8 sm:mb-12">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                  {selectedCategory ? "More Stories" : "Latest from Our Ecosystem"}
                </h2>
                <p className="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto leading-relaxed">
                  Stay connected with the latest developments, insights from our team, updates from local partners, and
                  breaking news across medical, science, robotics, military, TXMX Boxing, and creative industries
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {recentPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Empty State */}
          {filteredPosts.length === 0 && (
            <div className="text-center py-12 sm:py-16">
              <div className="relative mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full mx-auto flex items-center justify-center">
                  <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-purple-400 rounded-full animate-pulse" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
                {selectedCategory ? "No posts in this category yet!" : "Coming Soon!"}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 max-w-md mx-auto leading-relaxed">
                {selectedCategory
                  ? "Try selecting a different category or check back later for new content."
                  : "We're preparing amazing content covering our entire ecosystem. Check back soon for insights, news, and stories from the 434 Media community!"}
              </p>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-full font-medium hover:from-emerald-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
                >
                  View All Posts
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

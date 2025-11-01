"use client"

import { useState, useEffect } from "react"
import { BookOpen, ChevronDown } from "lucide-react"
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoading(true)
        
        // Always create categories from posts first
        const uniqueCategories = [...new Set(posts.map(post => post.category).filter(Boolean))]
        const categoriesData = uniqueCategories.map((categoryName, index) => ({
          id: `cat-${index}`,
          name: categoryName,
          slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
          post_count: posts.filter(post => post.category === categoryName).length,
          created_at: new Date().toISOString()
        }))
        setCategories(categoriesData)
      } catch (error) {
        console.error("Error loading blog categories:", error)
        setCategories([])
      } finally {
        setLoading(false)
      }
    }

    if (posts.length > 0) {
      loadCategories()
    }
  }, [posts])

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

  const selectedCategoryName = selectedCategory || "All Posts"

  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-gradient-to-br from-neutral-950 via-neutral-900 to-black pt-32 md:pt-36 md:pb-28 pb-24 overflow-hidden">
        {/* Sophisticated 434 Media Logo Pattern */}
        <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
          <div
            className="absolute inset-0 sm:bg-[length:140px_140px]"
            style={{
              backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
              backgroundSize: "80px 80px",
              backgroundRepeat: "repeat",
              backgroundPosition: "0 0",
              animation: "float 25s ease-in-out infinite",
              filter: "brightness(0.5) contrast(0.7)",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4 max-w-4xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-200 bg-clip-text text-transparent">
                  News & Insights
                </span>
              </h1>

              <p className="mb-8 md:mb-0 text-base md:text-lg text-gray-300 leading-relaxed max-w-xs md:max-w-2xl mx-auto">
                Your destination for insights from the <span className="text-white font-semibold">434 MEDIA</span> team,
                our local partners, and our diverse ecosystem.
              </p>
            </div>

            <div className="py-4">
              <ScrollSpinLogo />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="mb-12">
            {/* Mobile Dropdown */}
            <div className="md:hidden relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <span>{selectedCategoryName}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setSelectedCategory(null)
                      setIsDropdownOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                      selectedCategory === null ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    All Posts
                  </button>
                  {categories &&
                    categories.length > 0 &&
                    categories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => {
                          setSelectedCategory(category.name)
                          setIsDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                          selectedCategory === category.name
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Desktop Horizontal Navigation */}
            <div className="hidden md:block border-b border-gray-200">
              <div className="flex items-center gap-1 overflow-x-auto pb-4 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === null
                      ? "text-gray-900 border-b-2 border-gray-900 -mb-[1px]"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All Posts
                </button>
                {categories &&
                  categories.length > 0 &&
                  categories.map((category) => (
                    <button
                      key={category.name}
                      onClick={() => setSelectedCategory(category.name)}
                      className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                        selectedCategory === category.name
                          ? "text-gray-900 border-b-2 border-gray-900 -mb-[1px]"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
              </div>
            </div>
          </nav>

          {/* Featured Post */}
          {featuredPost && (
            <div className="mb-16">
              <h2 className="sr-only">Featured article</h2>
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Recent Posts Grid */}
          {recentPosts && recentPosts.length > 0 && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Latest Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {recentPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* Minimal Empty State */}
          {filteredPosts.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedCategory ? "No posts in this category" : "No posts yet"}
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                {selectedCategory
                  ? "Try selecting a different category or check back later."
                  : "Check back soon for new content."}
              </p>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
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

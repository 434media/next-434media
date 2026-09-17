"use client"

import { useState, useEffect } from "react"
import { BookOpen, ChevronDown } from "lucide-react"
import BlogCard from "@/components/blog/BlogCard"
import type { BlogPost, BlogCategory } from "@/types/blog-types"

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

  // All posts go in the grid (no separate featured post)
  const allPosts = filteredPosts

  const selectedCategoryName = selectedCategory || "All Posts"

  return (
    <div className="min-h-[100dvh] bg-white">
      <h1 className="sr-only">News & Insights</h1>

      {/* The hero used to clear the fixed navbar. This section is now first, so its
          top padding does: navbar height (64px mobile, 58px desktop, unscrolled)
          plus the spacing this section already had below the hero. */}
      <section className="pt-28 sm:pt-32 lg:pt-36 pb-12 sm:pb-16 lg:pb-20 bg-white">
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

          {/* Posts Grid */}
          {allPosts && allPosts.length > 0 && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8 tracking-tight">Latest Articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {allPosts.map((post) => (
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

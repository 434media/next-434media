"use client"

import type { Product } from "@/app/lib/shopify/types"
import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import Image from "next/image"

// Types for search suggestions
type SearchSuggestion = {
  text: string
  type: "trending" | "recent" | "collection"
  image?: string
}

export default function EnhancedSearch() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams?.get("q") || "")
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Trending searches - could be fetched from an API in a real implementation
  const trendingSearches: SearchSuggestion[] = [
    { text: "TXMX Boxing", type: "trending" },
    { text: "Vemos Vamos", type: "trending" },
    { text: "MilCity USA", type: "trending" },
    { text: "DEVSA", type: "trending" },
  ]

  // Collections - could be fetched from Shopify in a real implementation
  const collections: SearchSuggestion[] = [
    {
      text: "TXMX Boxing",
      type: "collection",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX+Hero+Banner.jpg",
    },
    {
      text: "Vemos Vamos",
      type: "collection",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/VV+Web+Banner+2.jpg",
    },
    {
      text: "MilCity USA",
      type: "collection",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/MilCity.jpg",
    },
    {
      text: "DEVSA",
      type: "collection",
      image: "https://ampd-asset.s3.us-east-2.amazonaws.com/DEVSA+Web+Banner.jpg",
    },
  ]

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const storedSearches = localStorage.getItem("recentSearches")
    if (storedSearches) {
      try {
        setRecentSearches(JSON.parse(storedSearches))
      } catch (e) {
        console.error("Failed to parse recent searches", e)
        setRecentSearches([])
      }
    }
  }, [])

  // Fetch search results when query changes (with debounce)
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if query is too short
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([])
      setIsLoading(false)
      return
    }

    // Set loading state immediately
    setIsLoading(true)

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Use the API route instead of directly calling getProducts
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        console.log("Search results:", data.products) // Debug log
        setSearchResults(data.products || [])
      } catch (error) {
        console.error("Error fetching search results:", error)
        setSearchResults([])
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return

    setRecentSearches((prev) => {
      const newSearches = [search, ...prev.filter((s) => s !== search)].slice(0, 5)
      localStorage.setItem("recentSearches", JSON.stringify(newSearches))
      return newSearches
    })
  }, [])

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    saveRecentSearch(query)

    // Navigate to search page
    router.push(`/search?q=${encodeURIComponent(query)}`)
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    saveRecentSearch(suggestion)

    // Navigate to search page
    router.push(`/search?q=${encodeURIComponent(suggestion)}`)
  }

  // Handle product click
  const handleProductClick = (product: Product) => {
    saveRecentSearch(product.title)

    // Navigate to product page
    router.push(`/product/${product.handle}`)
  }

  // Clear search input
  const clearSearch = () => {
    setQuery("")
    setSearchResults([])
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Clear recent searches
  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.removeItem("recentSearches")
    setRecentSearches([])
  }

  // Highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    const parts = text.split(regex)

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-emerald-500/20 text-emerald-300">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </>
    )
  }

  // Get product price display
  const getProductPrice = (product: Product) => {
    if (!product.priceRange) return null

    const { minVariantPrice } = product.priceRange
    if (!minVariantPrice) return null

    // Format price manually since formatPrice function is not available
    const amount = Number.parseFloat(minVariantPrice.amount)
    const currency = minVariantPrice.currencyCode || "USD"

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Get product image URL
  const getProductImageUrl = (product: Product) => {
    if (!product.images || product.images.length === 0) {
      return "/placeholder.svg?height=200&width=200&text=No%20Image"
    }

    return product.images[0].url
  }

  // Get product tags or vendor for display
  const getProductMetadata = (product: Product) => {
    // Use tags if available
    if (product.tags && product.tags.length > 0) {
      return product.tags[0]
    }

    // Fallback
    return null
  }

  return (
    <div className="relative w-full">
      <form ref={formRef} onSubmit={handleSubmit} className="relative w-full">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay to allow click events on suggestions
              setTimeout(() => setIsFocused(false), 200)
            }}
            placeholder="Search for products..."
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-700/50 bg-black/40 backdrop-blur-md px-4 py-3 pr-12 text-white placeholder:text-neutral-400 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
            aria-label="Search products"
          />

          {/* Animated search/clear icon */}
          <div className="absolute right-0 top-0 mr-3 flex h-full items-center text-white">
            {query ? (
              <motion.button
                type="button"
                onClick={clearSearch}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Clear search"
              >
                <i className="ri-close-line text-lg" aria-hidden="true"></i>
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Submit search"
              >
                <i className="ri-search-line text-lg" aria-hidden="true"></i>
              </motion.button>
            )}
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>
        )}
      </form>

      {/* Search results and suggestions dropdown - Fixed z-index and positioning */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-[100]"
            style={{ top: "auto", marginTop: "10px" }}
            ref={resultsRef}
          >
            <div className="relative rounded-lg border border-neutral-700/50 bg-black/90 backdrop-blur-xl shadow-2xl">
              <div className="max-h-[70vh] overflow-y-auto p-4">
                {/* Real-time search results */}
                {query.trim().length >= 2 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-neutral-300">
                        {isLoading ? "Searching..." : `Results for "${query}"`}
                      </h3>
                      {searchResults.length > 0 && (
                        <span className="text-xs text-neutral-400">
                          {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                        </span>
                      )}
                    </div>

                    {/* Loading skeleton */}
                    {isLoading && (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={`skeleton-${i}`} className="flex items-center space-x-4">
                            <div className="h-16 w-16 rounded bg-neutral-800/50 animate-pulse"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-3/4 rounded bg-neutral-800/50 animate-pulse"></div>
                              <div className="h-3 w-1/2 rounded bg-neutral-800/50 animate-pulse"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Results list */}
                    {!isLoading && searchResults.length > 0 && (
                      <div className="space-y-3">
                        {searchResults.map((product, index) => (
                          <motion.div
                            key={`result-${product.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group"
                          >
                            <button
                              onClick={() => handleProductClick(product)}
                              className="w-full flex items-start space-x-3 p-2 rounded-md hover:bg-white/10 text-left text-white transition-colors"
                            >
                              {/* Product image */}
                              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-neutral-800">
                                <Image
                                  src={getProductImageUrl(product) || "/placeholder.svg"}
                                  alt={product.title}
                                  fill
                                  className="object-cover transition-transform group-hover:scale-105"
                                />
                              </div>

                              {/* Product details */}
                              <div className="flex-1">
                                <h4 className="font-medium">{highlightMatch(product.title, query)}</h4>
                                {product.description && (
                                  <p className="mt-1 text-sm text-neutral-400 line-clamp-1">
                                    {highlightMatch(product.description, query)}
                                  </p>
                                )}
                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-sm font-medium text-emerald-400">
                                    {getProductPrice(product)}
                                  </span>
                                  {/* Use vendor or tags instead of collections */}
                                  {getProductMetadata(product) && (
                                    <span className="text-xs text-neutral-500">{getProductMetadata(product)}</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* No results */}
                    {!isLoading && query.trim().length >= 2 && searchResults.length === 0 && (
                      <div className="py-8 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/50 mb-3">
                          <i className="ri-search-line text-2xl text-neutral-400"></i>
                        </div>
                        <h4 className="text-lg font-medium text-white">No results found</h4>
                        <p className="mt-1 text-sm text-neutral-400">
                          Try different keywords or browse our collections
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Only show these sections if not showing search results */}
                {(!query.trim() || query.trim().length < 2) && (
                  <>
                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-neutral-300">Recent Searches</h3>
                          <button
                            onClick={clearRecentSearches}
                            className="text-xs text-neutral-400 hover:text-white transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((search, index) => (
                            <motion.button
                              key={`recent-${index}`}
                              onClick={() => handleSuggestionClick(search)}
                              className="w-full flex items-center px-3 py-2 rounded-md hover:bg-white/10 text-left text-white transition-colors"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              whileHover={{ x: 5 }}
                            >
                              <i className="ri-history-line mr-2 text-neutral-400" aria-hidden="true"></i>
                              <span>{search}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending searches */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-neutral-300 mb-2">Trending</h3>
                      <div className="space-y-1">
                        {trendingSearches.map((suggestion, index) => (
                          <motion.button
                            key={`trending-${index}`}
                            onClick={() => handleSuggestionClick(suggestion.text)}
                            className="w-full flex items-center px-3 py-2 rounded-md hover:bg-white/10 text-left text-white transition-colors"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ x: 5 }}
                          >
                            <i className="ri-fire-line mr-2 text-orange-400" aria-hidden="true"></i>
                            <span>{suggestion.text}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Collections */}
                    <div>
                      <h3 className="text-sm font-medium text-neutral-300 mb-3">Collections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {collections.map((collection, index) => (
                          <motion.div
                            key={`collection-${index}`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ y: -5 }}
                          >
                            <Link
                              href={`/search/${collection.text.toLowerCase().replace(/\s+/g, "-")}`}
                              className="group block rounded-md overflow-hidden border border-neutral-800 hover:border-neutral-600 transition-all duration-300"
                            >
                              <div className="relative h-24 w-full overflow-hidden bg-neutral-900">
                                {collection.image && (
                                  <Image
                                    src={collection.image || "/placeholder.svg"}
                                    alt={collection.text}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                                  <span className="text-white font-medium">{collection.text}</span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SearchSkeleton() {
  return (
    <div className="w-full">
      <div className="relative">
        <div className="w-full rounded-lg border border-neutral-700 bg-black/50 px-4 py-3 h-11"></div>
        <div className="absolute right-0 top-0 mr-3 flex h-full items-center">
          <div className="h-5 w-5 rounded-full bg-neutral-700/50"></div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, ArrowLeft, Search, Filter, X, ShoppingBag, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { SortFilterItem } from "../../lib/constants"
import type { Collection } from "../../lib/shopify/types"
import EnhancedSearch from "./layout/navbar/enhanced-search"

interface CollectionNavbarProps {
  collections: Collection[]
  sortOptions: SortFilterItem[]
  currentCollection: string
}

export function CollectionNavbar({ collections, sortOptions, currentCollection }: CollectionNavbarProps) {
  const navbarRef = useRef<HTMLDivElement>(null)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSort = searchParams.get("sort")

  // Find the active collection
  const activeCollection = collections.find((collection) => collection.handle === currentCollection) || collections[0]

  // Find the current sort option
  const currentSortOption = sortOptions.find((option) => option.slug === currentSort) || sortOptions[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setCollectionsOpen(false)
        setSortOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll() // Initial check

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchOpen) setSearchOpen(false)
        if (collectionsOpen) setCollectionsOpen(false)
        if (sortOpen) setSortOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [searchOpen, collectionsOpen, sortOpen])

  const handleClickOutside = () => {
    setCollectionsOpen(false)
    setSortOpen(false)
  }

  // Animation variants - modified to not use height animation which can cause overflow issues
  const searchPanelVariants = {
    hidden: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.2,
      },
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  }

  return (
    <>
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`sticky top-[72px] z-30 w-full backdrop-blur-md border-b transition-all duration-300 ${
          isScrolled ? "bg-black/90 border-neutral-800 shadow-lg py-3" : "bg-black/80 border-neutral-800/50 py-4"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div ref={navbarRef} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-xl font-bold text-white flex items-center"
              >
                <ShoppingBag className="mr-2 h-5 w-5 text-emerald-400" />
                Products
                {activeCollection && activeCollection.handle !== "" && (
                  <span className="text-neutral-400 hidden sm:inline ml-2">
                    in <span className="text-emerald-400">{activeCollection.title}</span>
                  </span>
                )}
              </motion.h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Enhanced Search Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  setSortOpen(false)
                  setCollectionsOpen(false)
                }}
                className={`flex items-center justify-center px-3 py-2 rounded-md ${
                  searchOpen
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white"
                } transition-colors`}
                aria-expanded={searchOpen}
                aria-controls="search-panel"
                aria-label={searchOpen ? "Close search" : "Search products"}
              >
                {searchOpen ? <X className="w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                <span className="text-sm font-medium">{searchOpen ? "Close" : "Search"}</span>
                {!searchOpen && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 15,
                      delay: 0.5,
                    }}
                    className="ml-2"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                  </motion.div>
                )}
              </motion.button>

              {/* Collections Dropdown */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="relative z-20 w-full sm:w-auto"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setCollectionsOpen(!collectionsOpen)
                    setSortOpen(false)
                    setSearchOpen(false)
                  }}
                  className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                  aria-expanded={collectionsOpen}
                  aria-haspopup="true"
                >
                  <span className="truncate max-w-[150px]">
                    {activeCollection ? activeCollection.title : "All Collections"}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${collectionsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {collectionsOpen && (
                    <>
                      <motion.div
                        className="fixed inset-0 z-10 bg-black/20 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClickOutside}
                      />
                      <motion.div
                        className="absolute left-0 right-0 sm:left-auto sm:right-auto sm:w-64 mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg overflow-hidden z-20"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <div className="py-1 max-h-[60vh] overflow-y-auto">
                          {collections.map((collection) => (
                            <Link
                              key={collection.handle}
                              href={collection.path}
                              className={`block px-4 py-2 text-sm hover:bg-neutral-700 transition-colors ${
                                collection.handle === currentCollection ? "bg-emerald-600 text-white" : "text-white"
                              }`}
                              onClick={() => setCollectionsOpen(false)}
                            >
                              {collection.title}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Sort Dropdown */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="relative z-20 w-full sm:w-auto"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSortOpen(!sortOpen)
                    setCollectionsOpen(false)
                    setSearchOpen(false)
                  }}
                  className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                  aria-expanded={sortOpen}
                  aria-haspopup="true"
                >
                  <span className="truncate max-w-[150px] flex items-center">
                    <Filter className="w-3 h-3 mr-1" />
                    Sort: {currentSortOption?.title || "Default Sort"}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${sortOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {sortOpen && (
                    <>
                      <motion.div
                        className="fixed inset-0 z-10 bg-black/20 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClickOutside}
                      />
                      <motion.div
                        className="absolute right-0 left-0 sm:left-auto sm:right-0 sm:w-64 mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg overflow-hidden z-20"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <div className="py-1">
                          {sortOptions.map((option) => {
                            // Create URL with the sort parameter
                            const newParams = new URLSearchParams(searchParams.toString())
                            if (option.slug) {
                              newParams.set("sort", option.slug)
                            } else {
                              newParams.delete("sort")
                            }
                            const href = `${pathname}?${newParams.toString()}`

                            return (
                              <Link
                                key={option.slug || "default"}
                                href={href}
                                className={`block px-4 py-2 text-sm hover:bg-neutral-700 transition-colors ${
                                  currentSort === option.slug ? "bg-emerald-600 text-white" : "text-white"
                                }`}
                                onClick={() => setSortOpen(false)}
                              >
                                {option.title}
                              </Link>
                            )
                          })}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Back to Shop Button - Only visible on desktop */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                <Link
                  href="/shop"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black ml-auto"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Back to Shop
                </Link>
              </motion.div>

              {/* Back to Shop Button - Only visible on mobile */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="w-full sm:hidden"
              >
                <Link
                  href="/shop"
                  className="flex sm:hidden items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black w-full justify-center mt-2"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Back to Shop
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Search Panel - Fixed the overflow issue */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            id="search-panel"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={searchPanelVariants}
            className="relative z-[40] w-full border-b border-neutral-800 bg-black/90 backdrop-blur-xl shadow-xl"
          >
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {/* Search container with higher z-index to ensure dropdown is visible */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="relative z-[50]" // Higher z-index for the search component
              >
                <EnhancedSearch />
              </motion.div>

              {/* Quick collection links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 pt-4 border-t border-neutral-800"
              >
                <h3 className="text-sm font-medium text-neutral-400 mb-3">Quick Links</h3>
                <div className="flex flex-wrap gap-2">
                  {collections.slice(0, 6).map((collection, index) => (
                    <motion.div
                      key={collection.handle}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      whileHover={{ y: -2, scale: 1.03 }}
                    >
                      <Link
                        href={collection.path}
                        onClick={() => setSearchOpen(false)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-800/50 hover:bg-neutral-700 text-white border border-neutral-700/50 hover:border-neutral-600 transition-all duration-200"
                      >
                        {collection.title}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

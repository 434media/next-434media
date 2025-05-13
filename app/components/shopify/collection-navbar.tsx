"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import type { SortFilterItem } from "../../lib/constants"
import type { Collection } from "../../lib/shopify/types"

interface CollectionNavbarProps {
  collections: Collection[]
  sortOptions: SortFilterItem[]
  currentCollection: string
}

export function CollectionNavbar({ collections, sortOptions, currentCollection }: CollectionNavbarProps) {
  const navbarRef = useRef<HTMLDivElement>(null)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
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

  const handleClickOutside = () => {
    setCollectionsOpen(false)
    setSortOpen(false)
  }

  return (
    <div className="sticky top-[72px] z-30 w-full bg-black/80 backdrop-blur-md border-b border-neutral-800 py-3 mb-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div ref={navbarRef} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h2 className="text-xl font-bold text-white">Products</h2>
            {activeCollection && activeCollection.handle !== "" && (
              <span className="text-neutral-400 hidden sm:inline ml-2">
                in <span className="text-emerald-400">{activeCollection.title}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Collections Dropdown */}
            <div className="relative z-20 w-full sm:w-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCollectionsOpen(!collectionsOpen)
                  setSortOpen(false)
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
                      className="fixed inset-0 z-10"
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
                      transition={{ duration: 0.2 }}
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
            </div>

            {/* Sort Dropdown */}
            <div className="relative z-20 w-full sm:w-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSortOpen(!sortOpen)
                  setCollectionsOpen(false)
                }}
                className="flex items-center justify-between w-full sm:w-auto gap-2 px-4 py-2 text-sm font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors"
                aria-expanded={sortOpen}
                aria-haspopup="true"
              >
                <span className="truncate max-w-[150px]">Sort: {currentSortOption?.title || "Default Sort"}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${sortOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {sortOpen && (
                  <>
                    <motion.div
                      className="fixed inset-0 z-10"
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
                      transition={{ duration: 0.2 }}
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
            </div>
            
            {/* Back to Shop Button - Only visible on desktop */}
            <Link
              href="/shop"
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black ml-auto"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Shop
            </Link>

            {/* Back to Shop Button - Only visible on mobile */}
            <Link
              href="/shop"
              className="flex sm:hidden items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black w-full justify-center mt-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
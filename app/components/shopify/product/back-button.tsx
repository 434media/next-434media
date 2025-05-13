"use client"

import type React from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "motion/react"
import { useEffect, useState, useRef } from "react"
import { ArrowLeft } from "lucide-react"

export default function BackButton() {
  const router = useRouter()
  const pathname = usePathname()
  const [referrer, setReferrer] = useState<string>("/search")
  const [collectionName, setCollectionName] = useState<string>("Store")
  // Create our own navigating ref instead of using the context
  const isNavigating = useRef<boolean>(false)

  // Capture the referrer when component mounts
  useEffect(() => {
    // Get referrer from document.referrer or sessionStorage
    const previousPage = sessionStorage.getItem("previousPage") || document.referrer

    // Extract the path from the full URL if it's from the same origin
    let referrerPath = "/search" // Default fallback
    let collection = "Store" // Default collection name

    if (previousPage) {
      try {
        // For same-origin referrers, we can extract the path
        if (previousPage.includes(window.location.origin)) {
          const url = new URL(previousPage)
          referrerPath = url.pathname

          // Extract collection name from path
          const pathParts = url.pathname.split("/")
          if (pathParts.includes("search") && pathParts.length > 2) {
            const searchIndex = pathParts.indexOf("search")
            // Make sure there's an element after "search" in the path
            if (searchIndex < pathParts.length - 1) {
              const collectionSlug = pathParts[searchIndex + 1]
              // Check if collectionSlug exists before using it
              if (collectionSlug) {
                // Convert slug to readable name (e.g., "txmx-boxing" to "TXMX Boxing")
                collection = collectionSlug
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")
              }
            }
          }
        } else if (previousPage.startsWith("/")) {
          // If it's already a path
          referrerPath = previousPage
        }

        // If referrer is a collection page, use it
        if (referrerPath.includes("/search/")) {
          setReferrer(referrerPath)
          setCollectionName(collection)
        } else if (referrerPath !== pathname) {
          // Only use referrer if it's not the current page
          setReferrer(referrerPath)
        }
      } catch (e) {
        console.error("Error parsing referrer:", e)
      }
    }

    // Store current page for future reference
    sessionStorage.setItem("previousPage", pathname)
  }, [pathname])

  // Force direct navigation without going through product state management
  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Set the navigating flag
    isNavigating.current = true

    // Try using window.history first
    try {
      window.history.back()

      // Fallback to router.push if history navigation doesn't work
      setTimeout(() => {
        // Check if we're still on the same page after 100ms
        if (window.location.pathname === pathname) {
          router.push(referrer)
        }
      }, 100)
    } catch (error) {
      // Direct fallback if history.back() fails
      router.push(referrer)
    }
  }

  // Add keyboard shortcut for Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Set the navigating flag
        isNavigating.current = true

        try {
          window.history.back()

          // Fallback if Escape + history doesn't work
          setTimeout(() => {
            if (window.location.pathname === pathname) {
              router.push(referrer)
            }
          }, 100)
        } catch (error) {
          router.push(referrer)
        }
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [router, pathname, referrer])

  return (
    <motion.button
      onClick={handleBack}
      className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black"
      aria-label={`Back to ${collectionName}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back to {collectionName}</span>
    </motion.button>
  )
}
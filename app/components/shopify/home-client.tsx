"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import { FrameGallery } from "./frame-gallery"
import type { Collection } from "../../lib/shopify/types"
import { useMediaQuery } from "../../hooks/use-mobile"
import { KeyboardNavigation } from "../keyboardNavigation"

interface HomeClientProps {
  collections: Collection[]
  collectionImages: Record<string, string>
}

export function HomeClient({ collections, collectionImages }: HomeClientProps) {
  const [isMounted, setIsMounted] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  // Function to scroll the container
  const scrollContainer = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const scrollAmount = direction === "left" ? -280 : 280 // Approximate width of a frame

    container.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    })
  }

  // Update scroll buttons state
  const updateScrollButtonsState = () => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10) // 10px buffer
  }

  // Set up scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      const handleScroll = () => updateScrollButtonsState()
      container.addEventListener("scroll", handleScroll)
      updateScrollButtonsState() // Initial check

      return () => {
        container.removeEventListener("scroll", handleScroll)
      }
    }
  }, [isMounted, isMobile])

  // Prevent hydration mismatch with framer-motion
  useEffect(() => {
    setIsMounted(true)

    // Get reference to the scroll container in the FrameGallery component
    if (isMobile) {
      const container = document.querySelector(".snap-x.snap-mandatory") as HTMLDivElement
      if (container) {
        scrollContainerRef.current = container
        updateScrollButtonsState()
      }
    }
  }, [isMobile])

  if (!isMounted) {
    return null
  }

  // Update collection images to include txmx-boxing if frontpage exists
  const updatedCollectionImages = { ...collectionImages }
  if (collectionImages["frontpage"] && !collectionImages["txmx-boxing"]) {
    updatedCollectionImages["txmx-boxing"] = collectionImages["frontpage"]
  }

  return (
    <>
      {/* Hero section with background - limited to just this section */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Background image with reduced opacity */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
            style={{
              backgroundImage: "url(https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg)",
            }}
            aria-hidden="true"
          />
          {/* Subtle overlay to make frames stand out */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" aria-hidden="true" />
        </div>

        {/* Content overlay */}
        <div className="relative z-1 flex h-full w-full flex-col items-center justify-center">
          {/* Skip link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded"
          >
            Skip to main content
          </a>

          <FrameGallery collections={collections} collectionImages={updatedCollectionImages} />

          {/* Keyboard navigation for accessibility */}
          <KeyboardNavigation
            onArrowLeft={() => canScrollLeft && scrollContainer("left")}
            onArrowRight={() => canScrollRight && scrollContainer("right")}
            enabled={isMobile}
          />

          {/* Instructions at the bottom of the hero section - adjusted for mobile */}
          <motion.div
            className={`absolute ${isMobile ? "bottom-4" : "bottom-8"} left-0 right-0 text-center px-4`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
          >
            <div className="mx-auto max-w-md rounded-full bg-black/70 px-4 py-2 sm:px-6 sm:py-3 text-white backdrop-blur-sm">
              <h2 className={`${isMobile ? "text-sm" : "text-lg"} font-medium`}>
                {isMobile ? "Swipe to explore collections" : "Click on any frame to explore our collections"}
              </h2>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main content anchor for skip link */}
      <div id="main-content" className="sr-only" tabIndex={-1} aria-hidden="true"></div>
    </>
  )
}
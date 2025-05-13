"use client"

import { useRef, useEffect } from "react"
import { motion } from "motion/react"
import type { Collection } from "../../lib/shopify/types"
import { Frame } from "./frame"
import { useMediaQuery } from "../../hooks/use-mobile"

interface FrameGalleryProps {
  collections: Collection[]
  collectionImages: Record<string, string>
}

export function FrameGallery({ collections, collectionImages }: FrameGalleryProps) {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const isTablet = useMediaQuery("(max-width: 1024px)")
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Container animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  // Determine the appropriate grid layout based on collection count and screen size
  const getGridClasses = () => {
    const collectionCount = collections.length

    if (isTablet && !isMobile) {
      return collectionCount === 3 ? "grid-cols-3 gap-4" : "grid-cols-2 gap-4"
    }

    // Desktop layout
    if (collectionCount === 3) {
      return "grid-cols-3 gap-5" // 3-column grid for 3 collections
    } else if (collectionCount === 1) {
      return "grid-cols-1 gap-5" // Single column for 1 collection
    } else if (collectionCount === 2) {
      return "grid-cols-2 gap-5" // 2-column grid for 2 collections
    } else {
      return "grid-cols-4 gap-5" // Default 4-column grid
    }
  }

  // Add scroll indicators on mobile
  useEffect(() => {
    if (isMobile && scrollContainerRef.current) {
      // Add a subtle horizontal bounce animation to indicate scrollability
      const container = scrollContainerRef.current

      // Only apply if we have enough items to scroll
      if (collections.length > 1 && container.scrollWidth > container.clientWidth) {
        // Create a subtle bounce effect
        const bounceAnimation = container.animate(
          [{ transform: "translateX(0px)" }, { transform: "translateX(-10px)" }, { transform: "translateX(0px)" }],
          {
            duration: 1500,
            iterations: 2,
            easing: "ease-in-out",
            delay: 1000, // Delay to let the page load first
          },
        )

        return () => {
          bounceAnimation.cancel()
        }
      }
    }
  }, [isMobile, collections.length])

  return (
    <motion.div
      className="relative h-full w-full flex items-center justify-center"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {isMobile ? (
        // Mobile horizontal scrollable layout
        <div className="absolute top-1/4 left-0 right-0 w-full px-4" aria-label="Scrollable collection frames gallery">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide"
            role="region"
            aria-label="Horizontally scrollable frames"
            tabIndex={0}
          >
            {collections.map((collection, index) => (
              <div
                key={collection.handle}
                className="flex-shrink-0 w-[80%] max-w-[280px] snap-center px-2 first:pl-4 last:pr-4"
              >
                <Frame collection={collection} index={index} collectionImage={collectionImages[collection.handle]} />
              </div>
            ))}
          </div>

          {/* Scroll indicators */}
          <div className="flex justify-center mt-4 space-x-1" aria-hidden="true">
            {collections.map((_, index) => (
              <div key={index} className="w-2 h-2 rounded-full bg-white/50" />
            ))}
          </div>
        </div>
      ) : (
        // Tablet and Desktop grid layout
        <div
          className={`absolute ${
            isTablet
              ? "left-1/2 top-[22%] -translate-x-1/2 w-[90%] max-w-3xl"
              : "left-1/2 top-[18%] -translate-x-1/2 w-[85%] max-w-5xl"
          } grid transform ${getGridClasses()}`}
          aria-label="Collection frames gallery"
        >
          {collections.map((collection, index) => (
            <Frame
              key={collection.handle}
              collection={collection}
              index={index}
              collectionImage={collectionImages[collection.handle]}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
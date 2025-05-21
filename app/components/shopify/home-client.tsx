"use client"

import { useState, useEffect, useRef } from "react"
import { VideoHero } from "./video-hero"
import type { Collection } from "../../lib/shopify/types"
import { useMediaQuery } from "../../hooks/use-mobile"

interface HomeClientProps {
  collections?: Collection[]
  collectionImages: Record<string, string>
}

export function HomeClient({ collectionImages }: HomeClientProps) {
  const [isMounted, setIsMounted] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Update scroll buttons state
  const updateScrollButtonsState = () => {
    if (!scrollContainerRef.current) return
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
      {/* Hero video section */}
      <VideoHero
        videoUrl="https://ampd-asset.s3.us-east-2.amazonaws.com/434_SHOP_1080_V001.mp4"
        title="434 SHOP"
        subtitle="Exclusive apparel and merchandise from 434 Media"
        ctaText="Explore Collections"
        ctaLink="#products-section"
      />

      {/* Main content anchor for skip link */}
      <div id="main-content" className="sr-only" tabIndex={-1} aria-hidden="true"></div>
    </>
  )
}

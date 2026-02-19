"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ShoppingBag, Play, Pause, ChevronUp, X } from "lucide-react"
import { cn } from "../../lib/utils"
import type { Collection } from "@/lib/shopify/types"

interface VideoHeroProps {
  videoUrl: string
  title?: string
  subtitle?: string
  ctaText?: string
  ctaLink?: string
  featuredCollection?: Collection
  secondaryCollection?: Collection
  tertiaryCollection?: Collection
  allCollectionsPath?: string
}

export function VideoHero({
  videoUrl,
  title = "434 SHOP",
  subtitle = "", // Removed default subtitle
  ctaText = "Shop Collections",
  ctaLink,
  featuredCollection,
  secondaryCollection,
  tertiaryCollection,
  allCollectionsPath = "/search", // Updated to /search
}: VideoHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const [collectionsRevealed, setCollectionsRevealed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitializedRef = useRef(false) // Track if video has been initialized

  // Toggle collections reveal
  const toggleCollectionsReveal = () => {
    setCollectionsRevealed(!collectionsRevealed)
  }

  // Handle collection navigation
  const navigateToCollection = (path?: string) => {
    if (path) {
      window.location.href = path
    } else {
      window.location.href = allCollectionsPath
    }
  }

  // Toggle video play/pause
  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch((error) => {
        console.error("Error playing video:", error)
        setHasError(true)
      })
    }
  }

  // Show controls when hovering over video
  const handleMouseEnter = () => {
    setShowControls(true)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  // Hide controls after a delay when mouse leaves
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2000)
  }

  // Initialize video - separated for clarity
  const initializeVideo = () => {
    const video = videoRef.current
    if (!video || hasInitializedRef.current) return

    // Set video properties
    video.muted = true
    video.loop = true
    video.playsInline = true

    // Play video once
    video.play().catch((error) => {
      console.error("Error auto-playing video:", error)
      // Don't set error state here as this is expected on some browsers
    })

    hasInitializedRef.current = true
  }

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleError = () => setHasError(true)
    const handleCanPlay = () => {
      setIsLoaded(true)
      // Initialize video once it can play
      if (!hasInitializedRef.current) {
        initializeVideo()
      }
    }

    // Add event listeners
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("canplay", handleCanPlay)

    // Clean up event listeners and reset initialization state on unmount
    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("canplay", handleCanPlay)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Reset initialization flag when component unmounts
      hasInitializedRef.current = false
    }
  }, [])

  // Close collections reveal when clicking outside
  useEffect(() => {
    if (!collectionsRevealed) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest(".collections-container") && !target.closest(".shop-now-button") && collectionsRevealed) {
        setCollectionsRevealed(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [collectionsRevealed])

  // Collection button variants for animation - optimized for snappier feel
  const collectionButtonVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      x: 0,
      scale: 0.9,
    },
    visible: (custom: number) => ({
      opacity: 1,
      y: -70, // All buttons appear above the main button
      x: custom * 160, // Spread horizontally (wider spacing)
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 500, // Increased stiffness for snappier animation
        damping: 22, // Reduced damping for more responsive feel
        mass: 0.8, // Reduced mass for faster movement
        delay: 0.03 * Math.abs(custom), // Reduced delay for quicker start
      },
    }),
    exit: (custom: number) => ({
      opacity: 0,
      y: -20,
      x: custom * 80, // Collapse toward center
      scale: 0.9,
      transition: {
        duration: 0.15, // Faster exit animation
        delay: 0.02 * Math.abs(custom), // Reduced delay for quicker exit
      },
    }),
  }

  // Main button variants for blur/fade effect - optimized for immediate feedback
  const mainButtonVariants = {
    normal: {
      filter: "blur(0px)",
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2 }, // Faster transition
    },
    blurred: {
      filter: "blur(1px)", // Reduced blur for subtler effect
      opacity: 0.8, // Less opacity reduction for better visibility
      scale: 0.98,
      transition: { duration: 0.2 }, // Faster transition
    },
  }

  // Background overlay variants - optimized for immediate feedback
  const overlayVariants = {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.2, // Faster transition
      },
    },
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-dvh overflow-hidden bg-black"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hidden title for SEO */}
      <h1 className="sr-only">{title}</h1>

      {/* Video Background */}
      <div className="absolute inset-0 bg-black">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <p className="text-xl mb-4">Unable to load video</p>
            <button
              onClick={() => {
                setHasError(false)
                hasInitializedRef.current = false // Reset initialization flag
                if (videoRef.current) {
                  videoRef.current.load()
                  initializeVideo() // Re-initialize video
                }
              }}
              className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
              isLoaded ? "opacity-100" : "opacity-0",
            )}
            playsInline
            loop
            muted={true}
            poster="https://ampd-asset.s3.us-east-2.amazonaws.com/shop-poster.png"
            aria-label={`${title} promotional video`}
            preload="auto"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}

        {/* Overlay gradient for better text visibility */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-black/30 pointer-events-none"></div>
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-12">
        {/* Top Logo Area - Empty now that title is hidden */}
        <div className="mt-8 sm:mt-12"></div>

        {/* Center Content - Empty to showcase video */}
        <div className="flex-1"></div>

        {/* Bottom CTA Area */}
        <AnimatePresence>
          {isLoaded && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }} // Faster animation
              className="flex flex-col items-center mb-8 sm:mb-12"
            >
              {/* Only render subtitle if it exists */}
              {subtitle && (
                <h2 className="text-xl sm:text-2xl font-medium text-white text-center mb-6 max-w-md">{subtitle}</h2>
              )}

              <div className="relative collections-container">
                {/* Collection reveal background overlay */}
                <AnimatePresence>
                  {collectionsRevealed && (
                    <motion.div
                      className="absolute inset-0 -m-8 bg-black/30 backdrop-blur-[2px] rounded-xl z-0"
                      variants={overlayVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    />
                  )}
                </AnimatePresence>

                {/* Main Shop Collections Button */}
                <motion.button
                  className="shop-now-button relative z-10 flex items-center gap-2 px-6 py-3 bg-white text-black rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                  onClick={toggleCollectionsReveal}
                  variants={mainButtonVariants}
                  animate={collectionsRevealed ? "blurred" : "normal"}
                  whileHover={collectionsRevealed ? {} : { scale: 1.05 }}
                  whileTap={collectionsRevealed ? {} : { scale: 0.98 }}
                >
                  <ShoppingBag size={18} />
                  {ctaText}
                  {collectionsRevealed ? <X size={16} className="ml-1" /> : <ChevronUp size={16} className="ml-1" />}
                </motion.button>

                {/* Collection Buttons - Horizontal layout with optimized animations */}
                <AnimatePresence>
                  {collectionsRevealed && (
                    <>
                      {/* Left Collection - DEVSA */}
                      {tertiaryCollection && (
                        <motion.button
                          custom={-1} // Left position
                          variants={collectionButtonVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigateToCollection(tertiaryCollection.path)}
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20 px-6 py-3 bg-black/40 backdrop-blur-sm text-white border border-white/30 rounded-full font-medium transition-all duration-300 hover:bg-black/60 whitespace-nowrap shadow-lg"
                          whileHover={{ scale: 1.05, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {tertiaryCollection.title}
                        </motion.button>
                      )}

                      {/* Center Collection - TXMX */}
                      {featuredCollection && (
                        <motion.button
                          custom={0} // Center position
                          variants={collectionButtonVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigateToCollection(featuredCollection.path)}
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20 px-6 py-3 bg-white text-black rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl whitespace-nowrap"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {featuredCollection.title}
                        </motion.button>
                      )}

                      {/* Right Collection - Vemos Vamos */}
                      {secondaryCollection && (
                        <motion.button
                          custom={1} // Right position
                          variants={collectionButtonVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          onClick={() => navigateToCollection(secondaryCollection.path)}
                          className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20 px-6 py-3 bg-black/40 backdrop-blur-sm text-white border border-white/30 rounded-full font-medium transition-all duration-300 hover:bg-black/60 whitespace-nowrap shadow-lg"
                          whileHover={{ scale: 1.05, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {secondaryCollection.title}
                        </motion.button>
                      )}

                      {/* View All Products Button */}
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                          opacity: 1,
                          y: 60,
                          transition: { delay: 0.15, duration: 0.3 }, // Faster animation
                        }}
                        exit={{ opacity: 0, y: 40, transition: { duration: 0.15 } }} // Faster exit
                        onClick={() => navigateToCollection("/search")}
                        className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20 px-5 py-2 bg-transparent text-white/80 rounded-full font-medium text-sm transition-all duration-300 hover:text-white"
                        whileHover={{ scale: 1.05, color: "rgba(255, 255, 255, 1)" }}
                        whileTap={{ scale: 0.98 }}
                      >
                        View All Products
                      </motion.button>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video Controls - Only play/pause, removed volume control */}
      <AnimatePresence>
        {showControls && isLoaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }} // Faster animation
            className="absolute bottom-6 right-6 flex items-center gap-3 z-20"
          >
            <motion.button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip to main content for accessibility */}
      <a
        href={ctaLink || "#products-section"}
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-white focus:rounded"
      >
        Skip to main content
      </a>
    </div>
  )
}

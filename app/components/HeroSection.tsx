"use client"

import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"
import { useMobile } from "../hooks/use-mobile"

function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      transition={{ delay: 2, duration: 1 }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, ease: "easeInOut" }}
        className="text-white/60"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 9L12 16L19 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </motion.div>
  )
}

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMobile = useMobile()
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playAttempted, setPlayAttempted] = useState(false)

  const videoUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434+Media.mp4"
  const posterUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434-poster.png"

  // Handle video loading and playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Function to handle successful loading
    const handleCanPlay = () => {
      setIsVideoLoaded(true)
      setIsLoading(false)

      if (!playAttempted) {
        setPlayAttempted(true)

        // Try to play the video - always muted for mobile compatibility
        video.muted = true

        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Autoplay was prevented:", error)

            // On mobile, we'll just show the poster image if autoplay fails
            if (isMobile) {
              console.log("Mobile device detected, using poster image as fallback")
              setIsVideoLoaded(false)
            }
          })
        }
      }
    }

    // Event listeners
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("canplaythrough", handleCanPlay)

    // Basic error handling
    video.addEventListener("error", (e) => {
      console.error("Video error:", e)
      setIsLoading(false)
      setError("Unable to load the video. Please refresh the page.")
    })

    // Cleanup
    return () => {
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("canplaythrough", handleCanPlay)
      video.removeEventListener("error", () => {})
    }
  }, [isMobile, playAttempted])

  // Handle manual retry
  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    setPlayAttempted(false)

    const video = videoRef.current
    if (video) {
      video.load()
    }
  }

  // For mobile, we'll prioritize showing the poster image if video doesn't play quickly
  useEffect(() => {
    if (isMobile && isLoading) {
      // On mobile, set a timeout to stop waiting for video after 3 seconds
      const timeoutId = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false)
          setIsVideoLoaded(false) // Just show the poster
        }
      }, 3000)

      return () => clearTimeout(timeoutId)
    }
  }, [isMobile, isLoading])

  return (
    <section className="relative h-screen w-full overflow-hidden bg-neutral-900" aria-labelledby="hero-heading">
      <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
        {/* Visually hidden text for screen readers and SEO */}
        <div className="sr-only">
          <h1 id="hero-heading">High-Impact Media & Marketing</h1>
          <p>
            We connect enterprises through ROI-driven brand media strategies that move audiences and deliver measurable
            results.
          </p>
        </div>

        {/* Poster Image (shown until video loads or as fallback) */}
        <AnimatePresence>
          {(!isVideoLoaded || error) && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src={posterUrl || "/placeholder.svg"}
                alt="434 Media promotional video showing creative media and marketing services"
                fill
                priority
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: "center" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Background - Full opacity for better showcase */}
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          preload="auto"
          poster={posterUrl}
          aria-label="434 Media promotional video showcasing creative media and marketing services"
          className={`absolute w-full h-full object-cover transition-opacity duration-500 ${
            isVideoLoaded && !error ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={videoUrl} type="video/mp4" />
          <p>Your browser does not support HTML5 video.</p>
        </video>

        {/* Loading Spinner - Only show for a limited time on mobile */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 z-10"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white" />
            <span className="sr-only">Loading video...</span>
          </div>
        )}

        {/* Error Message */}
        {error && !isMobile && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/80 text-white z-10"
            aria-live="assertive"
          >
            <p className="mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-white text-neutral-900 rounded hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Subtle overlay for better button visibility at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-[1]"></div>

        {/* View Our Work Button - Moved to bottom and redesigned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10"
        >
          <a
            href="#portfolio"
            className="inline-block border border-white/60 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-medium backdrop-blur-sm bg-black/10 hover:bg-white/10 hover:border-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-1 focus:ring-offset-black/20 shadow-lg hover:shadow-xl"
            onClick={(e) => {
              e.preventDefault()
              document.querySelector("#portfolio")?.scrollIntoView({ behavior: "smooth" })
            }}
          >
            View Our Work
          </a>
        </motion.div>

        {/* Scroll Indicator - Kept visible */}
        <ScrollIndicator />
      </div>
    </section>
  )
}


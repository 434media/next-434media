"use client"

import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"

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
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434+Media.mp4"
  const posterUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434-poster.png"

  // Simple video initialization
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Function to handle successful loading
    const handleCanPlay = () => {
      setIsVideoLoaded(true)
      setIsLoading(false)

      // Try to play the video
      const playPromise = video.play()

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn("Autoplay was prevented:", error)
          // Most browsers require user interaction before playing with sound
          // Try muted autoplay as a fallback
          video.muted = true
          video.play().catch((e) => {
            console.error("Even muted autoplay failed:", e)
            setError("Video playback was blocked by your browser. Please refresh the page.")
          })
        })
      }
    }

    // Event listeners
    video.addEventListener("canplay", handleCanPlay)

    // Basic error handling
    video.addEventListener("error", () => {
      setIsLoading(false)
      setError("Unable to load the video. Please refresh the page.")
    })

    return () => {
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("error", () => {})
    }
  }, [])

  // Handle manual retry
  const handleRetry = () => {
    setIsLoading(true)
    setError(null)

    const video = videoRef.current
    if (video) {
      video.load()
    }
  }

  return (
    <section
      className="relative h-screen w-full overflow-hidden bg-neutral-900"
      aria-label="434 Media promotional video section"
    >
      <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
        {/* Poster Image (shown until video loads) */}
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
                alt="434 Media background"
                fill
                priority
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: "center" }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Background - Simplified */}
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          preload="auto"
          poster={posterUrl}
          aria-hidden="true"
          className={`absolute w-full h-full object-cover transition-opacity duration-500 ${
            isVideoLoaded && !error ? "opacity-50" : "opacity-0"
          }`}
        >
          <source src={videoUrl} type="video/mp4" />
          <p>Your browser does not support HTML5 video.</p>
        </video>

        {/* Loading Spinner */}
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
        {error && (
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

        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <motion.h1
            className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-ggx88 mb-4 md:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            High-Impact Media & Marketing
          </motion.h1>
          <motion.p
            className="text-white/90 text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed mb-6 md:mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            We connect enterprises through ROI-driven brand media strategies that move audiences and deliver measurable
            results.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#portfolio"
              className="inline-block bg-emerald-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-semibold hover:bg-emerald-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              onClick={(e) => {
                e.preventDefault()
                document.querySelector("#portfolio")?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              View Our Work
            </a>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <ScrollIndicator />
      </div>
    </section>
  )
}


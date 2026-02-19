"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react"
import Image from "next/image"
import { useMobile } from "../hooks/use-mobile"

function ScrollIndicator() {
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 10], [0.6, 0])

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      style={{ opacity }}
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
  const [isIntersecting, setIsIntersecting] = useState(true) // Start as true to autoplay when visible
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempts, setLoadAttempts] = useState(0)

  const videoUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434+Media.mp4"
  const posterUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434-poster.png"

  // Intersection Observer to play/pause video based on visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      { threshold: 0.1 },
    )

    const currentVideo = videoRef.current
    if (currentVideo) {
      observer.observe(currentVideo)
    }

    return () => {
      if (currentVideo) {
        observer.unobserve(currentVideo)
      }
    }
  }, [])

  // Play/pause video based on visibility
  useEffect(() => {
    const currentVideo = videoRef.current
    if (!currentVideo || !isVideoLoaded) return

    if (isIntersecting) {
      const playPromise = currentVideo.play()

      // Handle play promise to avoid uncaught promise errors
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Error playing video:", error)
          // Don't show error to user for autoplay failures
          // Most likely due to browser autoplay policy
        })
      }
    } else {
      currentVideo.pause()
    }
  }, [isIntersecting, isVideoLoaded])

  // Load video with retry mechanism
  const loadVideo = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setLoadAttempts((prev) => prev + 1)

    if (videoRef.current) {
      videoRef.current.load()
    }
  }, [])

  // Initial video load
  useEffect(() => {
    loadVideo()
  }, [loadVideo])

  // Handle video load success
  const handleVideoLoad = () => {
    console.log("Video loaded successfully")
    setIsVideoLoaded(true)
    setIsLoading(false)
    setError(null)
  }

  // Handle video load error
  const handleVideoError = () => {
    console.error("Error loading video")
    setIsLoading(false)

    if (loadAttempts < 2 && !isMobile) {
      // Auto-retry up to 2 times for non-mobile
      setTimeout(loadVideo, 2000)
    } else if (isMobile) {
      // On mobile, just show the poster without error message
      console.log("Mobile device detected, using poster image as fallback")
      setIsVideoLoaded(false)
    } else {
      setError("Failed to load video. Please try again.")
    }
  }

  // For mobile, set a timeout to fall back to poster if video doesn't load quickly
  useEffect(() => {
    if (isMobile && isLoading) {
      const timeoutId = setTimeout(() => {
        if (isLoading) {
          console.log("Mobile timeout reached, using poster image as fallback")
          setIsLoading(false)
          setIsVideoLoaded(false)
        }
      }, 3000)

      return () => clearTimeout(timeoutId)
    }
  }, [isMobile, isLoading])

  return (
    <section className="relative h-dvh w-full overflow-hidden bg-neutral-950" aria-labelledby="hero-heading">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Visually hidden text for screen readers and SEO */}
        <div className="sr-only">
          <h1 id="hero-heading">Creative Media & Smart Marketing</h1>
          <p>
            Connecting enterprises in San Antonio and South Texas by leveraging networks to connect people, places, and
            things.
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
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={posterUrl}
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          aria-label="434 Media promotional video showcasing creative media and marketing services"
          className={`absolute w-full h-full object-cover transition-opacity duration-500 ${
            isVideoLoaded && !error ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src={videoUrl} type="video/mp4" />
          <p>Your browser does not support HTML5 video.</p>
        </video>

        {/* Loading indicator */}
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white/60" />
            <span className="sr-only">Loading video...</span>
          </div>
        )}

        {/* Error Message - Only show on non-mobile */}
        {error && !isMobile && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/80 text-white z-10"
            aria-live="assertive"
          >
            <p className="mb-4">{error}</p>
            <button
              onClick={loadVideo}
              className="px-4 py-2 bg-white text-neutral-900 rounded hover:bg-neutral-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-black/20 pointer-events-none z-1" />

        {/* Scroll Indicator */}
        <ScrollIndicator />
      </div>
    </section>
  )
}


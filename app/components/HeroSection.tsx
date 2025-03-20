"use client"

import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import { useMediaQuery } from "../hooks/use-mobile"
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react"

function ScrollIndicator() {
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 10], [1, 0])

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white text-base sm:text-lg font-geist-sans tracking-tight"
      style={{ opacity }}
      aria-live="polite"
    >
      Scroll to learn more
    </motion.div>
  )
}

export function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadAttempts, setLoadAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoUrl = useMemo(
    () =>
      isMobile
        ? "https://ampd-asset.s3.us-east-2.amazonaws.com/434+Media.mp4"
        : "https://ampd-asset.s3.us-east-2.amazonaws.com/434+Media.mp4",
    [isMobile],
  )

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      { threshold: 0.1 },
    )

    if (videoRef.current) {
      observer.observe(videoRef.current)
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isIntersecting && videoRef.current) {
      videoRef.current.play().catch((error) => console.error("Error playing video:", error))
    } else if (!isIntersecting && videoRef.current) {
      videoRef.current.pause()
    }
  }, [isIntersecting])

  const loadVideo = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setLoadAttempts((prev) => prev + 1)

    if (videoRef.current) {
      videoRef.current.load()
    }
  }, [])

  useEffect(() => {
    loadVideo()
  }, [loadVideo])

  const handleVideoLoad = () => {
    console.log("Video loaded successfully")
    setIsVideoLoaded(true)
    setIsLoading(false)
    setError(null)
  }

  const handleVideoError = () => {
    console.error("Error loading video")
    setIsLoading(false)
    setError("Failed to load video. Please try again.")
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-neutral-900">
      <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
        <AnimatePresence>
          {(!isVideoLoaded || error) && (
            <motion.img
              src="https://ampd-asset.s3.us-east-2.amazonaws.com/434-poster.png"
              alt="Video poster"
              className="absolute w-full h-full object-cover"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={handleVideoLoad}
          onError={handleVideoError}
          aria-label="434 Media promotional video"
          className={`absolute w-full h-full object-cover transition-opacity duration-500 ${
            isVideoLoaded && !error ? "opacity-50" : "opacity-0"
          }`}
        >
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/80 text-white">
            <p className="mb-4">{error}</p>
            <button
              onClick={loadVideo}
              className="px-4 py-2 bg-white text-neutral-900 rounded hover:bg-neutral-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        <ScrollIndicator />
      </div>
    </div>
  )
}


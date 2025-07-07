"use client"
import type React from "react"
import { useRef } from "react"
import { motion, useInView } from "motion/react"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState, useCallback } from "react"
import type { Dictionary } from "@/app/types/dictionary"
import { useLanguage } from "@/app/context/language-context"

interface SDOHStartupBootcampProps {
  locale: Locale
  dict: Dictionary
}

const BootcampCarousel = () => {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const images = [
    {
      src: "https://ampd-asset.s3.us-east-2.amazonaws.com/SUBC-1.jpg",
      alt: "RGV Startup Week - Bootcamp",
    },
    {
      src: "https://ampd-asset.s3.us-east-2.amazonaws.com/SUBC-4.jpg",
      alt: "RGV Startup Week - Bootcamp",
    },
    {
      src: "https://ampd-asset.s3.us-east-2.amazonaws.com/SUBC-5.jpg",
      alt: "RGV Startup Week - Bootcamp",
    },
    {
      src: "https://ampd-asset.s3.us-east-2.amazonaws.com/SUBC-6.jpg",
      alt: "RGV Startup Week - Bootcamp",
    },
  ]

  // Handle slide navigation - simplified for reliability
  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  // Direct navigation to a specific slide
  const goToSlide = (index: number) => {
    setActiveSlide(index)
  }

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
      }

      autoPlayRef.current = setInterval(() => {
        nextSlide()
      }, 5000)
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current)
      }
    }
  }, [isAutoPlaying, nextSlide])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        prevSlide()
      } else if (e.key === "ArrowRight") {
        nextSlide()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [nextSlide, prevSlide])

  // Touch navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) {
      // Swipe left
      nextSlide()
    }

    if (touchStart - touchEnd < -50) {
      // Swipe right
      prevSlide()
    }
  }

  // Pause auto-play on hover
  const handleMouseEnter = () => {
    setIsAutoPlaying(false)
  }

  const handleMouseLeave = () => {
    setIsAutoPlaying(true)
  }

  // Update progress bar
  useEffect(() => {
    if (progressBarRef.current) {
      const width = ((activeSlide + 1) / images.length) * 100
      progressBarRef.current.style.width = `${width}%`
    }
  }, [activeSlide, images.length])

  return (
    <div
      className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={carouselRef}
      aria-roledescription="carousel"
      aria-label="Bootcamp image carousel"
      style={{ aspectRatio: "1080/1350" }}
    >
      {/* Enhanced decorative elements */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-600 z-10"></div>
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl animate-pulse"></div>
      <div
        className="absolute -bottom-32 -right-32 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      ></div>

      {/* Enhanced progress bar */}
      <div
        className="absolute top-0 left-0 h-2 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600 z-20 transition-all duration-500 ease-out shadow-lg"
        ref={progressBarRef}
      ></div>

      {/* Slides container */}
      <div className="relative w-full h-full">
        {images.map((image, index) => (
          <div
            key={`bootcamp-slide-${index}`}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === activeSlide
                ? "opacity-100 translate-x-0 scale-100 z-10"
                : index < activeSlide
                  ? "opacity-0 -translate-x-full scale-95 z-0"
                  : "opacity-0 translate-x-full scale-95 z-0"
            }`}
            aria-hidden={index !== activeSlide}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${images.length}: ${image.alt}`}
          >
            {/* Background image with enhanced parallax effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0 scale-110 transition-transform duration-[20000ms] ease-linear"
                style={{
                  backgroundImage: `url(${image.src})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transform: index === activeSlide ? "scale(1.08)" : "scale(1)",
                }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-transparent to-blue-900/10"></div>
            </div>

            {/* Enhanced caption - only on first slide */}
            {index === 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                <div className="max-w-2xl">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="inline-flex items-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold tracking-wider mb-4 shadow-lg"
                  >
                    <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                    STARTUP BOOTCAMP
                  </motion.div>
                  <motion.h3
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                    className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight"
                    style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                  >
                    Early-Stage Program
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.9 }}
                    className="text-white/95 text-base sm:text-lg leading-relaxed font-medium"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
                  >
                    A hands-on program that helped local entrepreneurs turn ideas into action with guidance on business
                    models, impact measurement, and funding strategies.
                  </motion.p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Enhanced navigation controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-between items-center px-8 z-30">
        {/* Enhanced slide counter */}
        <div className="bg-white/90 backdrop-blur-md text-cyan-800 px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-white/20">
          <span className="text-cyan-600">{activeSlide + 1}</span>
          <span className="text-cyan-400 mx-1">/</span>
          <span className="text-cyan-500">{images.length}</span>
        </div>

        {/* Enhanced pagination dots */}
        <div className="flex items-center justify-center space-x-3">
          {images.map((_, index) => (
            <button
              key={`bootcamp-dot-${index}`}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full shadow-lg ${
                index === activeSlide
                  ? "w-12 h-3 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/50"
                  : "w-3 h-3 bg-white/80 hover:bg-white hover:scale-110"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeSlide ? "true" : "false"}
            />
          ))}
        </div>

        {/* Enhanced auto-play toggle */}
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="bg-white/90 backdrop-blur-md text-cyan-800 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full p-3 shadow-lg border border-white/20 transition-all duration-300 hover:scale-110"
          aria-label={isAutoPlaying ? "Pause auto-play" : "Start auto-play"}
        >
          {isAutoPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Enhanced Previous/Next buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md text-cyan-700 flex items-center justify-center z-20 hover:bg-white hover:text-cyan-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-lg hover:scale-110"
        aria-label="Previous slide"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur-md text-cyan-700 flex items-center justify-center z-20 hover:bg-white hover:text-cyan-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-lg hover:scale-110"
        aria-label="Next slide"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Enhanced floating particles for visual interest */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 left-1/4 w-3 h-3 bg-cyan-400 rounded-full blur-sm"
        />
        <motion.div
          animate={{
            y: [0, -25, 0],
            x: [0, -20, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute top-3/4 left-1/3 w-4 h-4 bg-blue-500 rounded-full blur-sm"
        />
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{
            duration: 6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 4,
          }}
          className="absolute top-1/2 right-1/4 w-2 h-2 bg-cyan-300 rounded-full blur-sm"
        />
        <motion.div
          animate={{
            y: [0, -35, 0],
            x: [0, -10, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 12,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 6,
          }}
          className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-blue-400 rounded-full blur-sm"
        />
      </div>
    </div>
  )
}

export default function SDOHStartupBootcamp({ locale, dict }: SDOHStartupBootcampProps) {
  const titleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLDivElement>(null)

  const titleInView = useInView(titleRef, { once: true, amount: 0.3 })
  const contentInView = useInView(contentRef, { once: true, amount: 0.2 })
  const imageInView = useInView(imageRef, { once: true, amount: 0.3 })

  // Use language context for dynamic translations
  const { dictionary } = useLanguage()

  // Track when dictionary or locale changes
  const [key, setKey] = useState(0)

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHStartupBootcamp: Locale changed to ${locale}`)
    console.log(`SDOHStartupBootcamp: Dictionary available:`, !!dict)
  }, [locale, dict])

  // Use the language context dictionary first, then fallback to props, then defaults
  const d = dictionary?.sdoh?.bootcamp ||
    dict?.sdoh?.bootcamp || {
      // Default English text
      title: "Startup Bootcamp",
      subtitle: "Early-Stage Program",
      description:
        "A hands-on, early-stage program that helps local entrepreneurs turn ideas into action. Participants receive guidance on business models, impact measurement, funding strategies, and how to build solutions that address real community needs.",
      keyFocus: "Key Focus:",
      keyFocusDescription:
        "Participants received hands-on mentorship, networking opportunities, and practical tools to build solutions addressing real community health needs.",
    }

  // Type-safe string extraction
  const getStringValue = (value: any): string => {
    if (typeof value === "string") return value
    return String(value || "")
  }

  return (
    <div className="space-y-16 md:space-y-20">
      {/* TITLE SECTION - Full Width Row - Similar to SeminarSeries */}
      <motion.div
        ref={titleRef}
        initial={{ opacity: 0 }}
        animate={titleInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="relative text-center"
      >
        {/* Enhanced background glow effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-cyan-200/40 via-cyan-100/25 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-radial from-blue-200/30 to-transparent rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-radial from-yellow-200/25 to-transparent rounded-full blur-2xl" />
        </div>

        {/* Component Number - Enhanced with dramatic entrance */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={titleInView ? { scale: 1, rotate: 0 } : {}}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.3,
          }}
          className="relative inline-block mb-8"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400 to-cyan-600 blur-xl opacity-60 animate-pulse" />

          {/* Main number container */}
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-600 via-cyan-500 to-cyan-700 text-white flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-500 group">
            {/* Inner highlight */}
            <div className="absolute inset-1 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />

            {/* Number */}
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={titleInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="relative text-4xl font-black tracking-tight z-10"
              style={{
                textShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              2
            </motion.span>

            {/* Animated border */}
            <motion.div
              initial={{ pathLength: 0 }}
              animate={titleInView ? { pathLength: 1 } : {}}
              transition={{ delay: 1, duration: 2 }}
              className="absolute inset-0 rounded-3xl"
            >
              <svg className="w-full h-full" viewBox="0 0 96 96">
                <motion.rect
                  x="2"
                  y="2"
                  width="92"
                  height="92"
                  rx="20"
                  ry="20"
                  fill="none"
                  stroke="url(#gradient2)"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  initial={{ pathLength: 0, rotate: 0 }}
                  animate={titleInView ? { pathLength: 1, rotate: 360 } : {}}
                  transition={{ delay: 1, duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "loop" }}
                />
                <defs>
                  <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#0891b2" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* Title with enhanced typography and animations */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Main title */}
          <motion.h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-none mb-6">
            {/* Animated gradient text */}
            <motion.span
              initial={{ backgroundPosition: "0% 50%" }}
              animate={titleInView ? { backgroundPosition: "100% 50%" } : {}}
              transition={{
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
                delay: 1.2,
              }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 bg-[length:200%_100%]"
              style={{
                textShadow: "0 4px 20px rgba(6, 182, 212, 0.3)",
                filter: "drop-shadow(0 4px 20px rgba(6, 182, 212, 0.2))",
              }}
            >
              {getStringValue(d.title)}
            </motion.span>
          </motion.h2>

          {/* Decorative underline with animation */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={titleInView ? { scaleX: 1, opacity: 1 } : {}}
            transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
            className="relative mx-auto mb-8"
            style={{ width: "min(400px, 80%)" }}
          >
            {/* Main underline */}
            <div className="h-2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />

            {/* Animated accent dots */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={titleInView ? { x: "100%" } : {}}
              transition={{
                duration: 3,
                delay: 2,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "loop",
                ease: "easeInOut",
              }}
              className="absolute top-0 left-0 w-4 h-2 bg-blue-400 rounded-full blur-sm"
            />
          </motion.div>

          {/* Section introduction text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 1.6 }}
            className="relative"
          >
            <p className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-relaxed max-w-3xl mx-auto">
              {locale === "es"
                ? "Descubre el segundo componente de nuestro programa integral"
                : "Discover the second component of our comprehensive program"}
            </p>

            {/* Decorative side elements */}
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-8 w-1 h-12 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-8 w-1 h-12 bg-gradient-to-b from-transparent via-cyan-400 to-transparent rounded-full opacity-60" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* CONTENT SECTION - Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-center">
        {/* Text Content Column */}
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, x: -50 }}
          animate={contentInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="order-2 md:order-1 space-y-8"
        >
          {/* Subtitle badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={contentInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="inline-flex items-center p-3 px-6 rounded-full bg-gradient-to-r from-cyan-100/90 to-blue-100/90 backdrop-blur-sm text-cyan-800 text-sm font-bold shadow-lg border border-cyan-200/50"
          >
            <div className="w-2 h-2 bg-cyan-500 rounded-full mr-3 animate-pulse"></div>
            {getStringValue(d.subtitle)}
          </motion.div>

          {/* Main description */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={contentInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="relative"
          >
            <p className="text-lg md:text-xl text-neutral-700 leading-relaxed font-light max-w-2xl">
              {getStringValue(d.description)}
            </p>

            {/* Animated accent line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={contentInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, delay: 1 }}
              className="absolute -left-4 top-0 w-1 h-full bg-gradient-to-b from-cyan-400 via-cyan-300 to-transparent rounded-full origin-top"
            />
          </motion.div>

          {/* Enhanced feature highlight box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={contentInView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
            className="relative"
          >
            {/* Enhanced background with multiple layers */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-cyan-300/15 to-blue-400/10 rounded-2xl blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50 via-cyan-25 to-white rounded-2xl border border-blue-200/50" />

            {/* Animated border accent */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={contentInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1.2, delay: 1.2 }}
              className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-blue-400 via-cyan-500 to-blue-400 rounded-full origin-top"
            />

            <div className="relative p-8 rounded-2xl">
              <motion.p
                initial={{ opacity: 0 }}
                animate={contentInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.8, delay: 1.4 }}
                className="text-lg leading-relaxed font-medium text-neutral-700"
              >
                <span className="font-bold text-cyan-700">{getStringValue(d.keyFocus)}</span>{" "}
                {getStringValue(d.keyFocusDescription)}
              </motion.p>

              {/* Decorative corner elements */}
              <div className="absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 border-blue-400/40 rounded-tr-xl" />
              <div className="absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 border-blue-400/40 rounded-bl-xl" />
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Image Column */}
        <motion.div
          ref={imageRef}
          initial={{ opacity: 0, x: 50, rotateY: -15 }}
          animate={imageInView ? { opacity: 1, x: 0, rotateY: 0 } : {}}
          transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
          className="order-1 md:order-2 relative"
        >
          {/* Enhanced decorative background elements */}
          <div className="absolute -inset-12 -z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.6 }}
              className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-radial from-cyan-200/50 via-cyan-100/25 to-transparent rounded-full blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-radial from-blue-200/50 via-blue-100/25 to-transparent rounded-full blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={imageInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 1.5, delay: 1 }}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-radial from-cyan-300/40 to-transparent rounded-full blur-xl"
            />
          </div>

          {/* Enhanced Carousel Container */}
          <motion.div
            initial={{ scale: 0.9, rotateX: 10 }}
            animate={imageInView ? { scale: 1, rotateX: 0 } : {}}
            transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
            className="relative z-10 group"
          >
            {/* Outer glow effect */}
            <div className="absolute -inset-6 bg-gradient-to-r from-cyan-400/30 via-blue-400/30 to-cyan-400/30 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

            {/* Enhanced Carousel */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl border-2 border-cyan-200/50 group transition-all duration-700 hover:shadow-cyan-200/60 hover:border-cyan-300/70">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-300/5 z-0 group-hover:opacity-70 transition-opacity duration-500"></div>
              <BootcampCarousel />
            </div>

            {/* Enhanced corner accent elements */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={imageInView ? { scale: 1, rotate: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.6 }}
              className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full shadow-xl"
            />
            <motion.div
              initial={{ scale: 0, rotate: 45 }}
              animate={imageInView ? { scale: 1, rotate: 0 } : {}}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="absolute -bottom-4 -right-4 w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full shadow-xl"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

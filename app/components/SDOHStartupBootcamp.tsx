"use client"
import type React from "react"

import { FadeIn } from "./FadeIn"
import type { Locale } from "../../i18n-config"
import { useEffect, useState, useRef, useCallback } from "react"

interface SDOHStartupBootcampProps {
  locale: Locale
  dict: any
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
      className="relative overflow-hidden rounded-2xl shadow-xl bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={carouselRef}
      aria-roledescription="carousel"
      aria-label="Bootcamp image carousel"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-cyan-600 z-10"></div>
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-400/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>

      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 h-1 bg-cyan-500 z-20 transition-all duration-500 ease-out"
        ref={progressBarRef}
      ></div>

      {/* Slides container */}
      <div className="relative h-72 sm:h-96 md:h-[500px]">
        {images.map((image, index) => (
          <div
            key={`bootcamp-slide-${index}`}
            className={`absolute inset-0 transition-all duration-700 ease-in-out ${
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
            {/* Background image with parallax effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0 scale-110 transition-transform duration-[15000ms] ease-linear"
                style={{
                  backgroundImage: `url(${image.src})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transform: index === activeSlide ? "scale(1.05)" : "scale(1)",
                }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent"></div>
            </div>

            {/* Caption - only on first slide */}
            {index === 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 bg-gradient-to-t from-black/80 to-transparent">
                <div className="max-w-lg">
                  <div className="inline-block bg-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider mb-3">
                    STARTUP BOOTCAMP
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">Early-Stage Program</h3>
                  <p className="text-white/90 text-sm sm:text-base">
                    A hands-on program that helped local entrepreneurs turn ideas into action with guidance on business
                    models, impact measurement, and funding strategies.
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-between items-center px-6 z-30">
        {/* Slide counter */}
        <div className="bg-white/80 backdrop-blur-sm text-cyan-800 px-3 py-1 rounded-full text-sm font-mono">
          {activeSlide + 1} / {images.length}
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center space-x-2">
          {images.map((_, index) => (
            <button
              key={`bootcamp-dot-${index}`}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full ${
                index === activeSlide ? "w-8 h-2 bg-cyan-500" : "w-2 h-2 bg-white/70 hover:bg-white"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeSlide ? "true" : "false"}
            />
          ))}
        </div>

        {/* Auto-play toggle */}
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="bg-white/80 backdrop-blur-sm text-cyan-800 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-full p-2"
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

      {/* Previous/Next buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white/70 backdrop-blur-sm text-cyan-700 flex items-center justify-center z-20 hover:bg-white hover:text-cyan-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Previous slide"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white/70 backdrop-blur-sm text-cyan-700 flex items-center justify-center z-20 hover:bg-white hover:text-cyan-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Next slide"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Floating particles for visual interest */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-float-slow opacity-60"></div>
        <div className="absolute top-3/4 left-1/3 w-3 h-3 bg-cyan-500 rounded-full animate-float-medium opacity-60"></div>
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-float-fast opacity-60"></div>
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-cyan-500 rounded-full animate-float-slow opacity-60"></div>
      </div>

      {/* Add these animations to your globals.css or use inline styles */}
      <style jsx>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-15px) translateX(-10px); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-10px) translateX(5px); }
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 6s ease-in-out infinite;
        }
        .animate-float-fast {
          animation: float-fast 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default function SDOHStartupBootcamp({ locale, dict }: SDOHStartupBootcampProps) {
  // Track when dictionary or locale changes
  const [key, setKey] = useState(0)

  // Force re-render when locale or dictionary changes
  useEffect(() => {
    setKey((prev) => prev + 1)
    console.log(`SDOHStartupBootcamp: Locale changed to ${locale}`)
    console.log(`SDOHStartupBootcamp: Dictionary available:`, !!dict)
  }, [locale, dict])

  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.sdoh?.bootcamp || {
    // Default English text
    title: "Startup Bootcamp",
    subtitle: "Early-Stage Program",
    description:
      "A hands-on, early-stage program that helps local entrepreneurs turn ideas into action. Participants receive guidance on business models, impact measurement, funding strategies, and how to build solutions that address real community needs.",
  }

  return (
    <FadeIn key={key}>
      <div className="max-w-3xl mx-auto mb-16 sm:mb-20">
        <div className="text-center mb-10">
          {/* Updated heading with component number */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xl font-bold mr-4 shadow-lg">
              2
            </div>
            <h2 className="font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-cyan-700">
              {d.title}
            </h2>
          </div>
          <div className="inline-block p-1.5 px-3 mb-4 rounded-full bg-cyan-100/80 backdrop-blur-sm text-cyan-800 text-sm font-medium">
            {d.subtitle}
          </div>
          <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-2xl mx-auto">{d.description}</p>
        </div>

        {/* Enhanced Image Carousel */}
        <div className="relative overflow-hidden rounded-2xl shadow-xl border border-cyan-200 group transition-all duration-500 hover:shadow-cyan-200/30 hover:border-cyan-300">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-cyan-300/10 z-0 group-hover:opacity-70 transition-opacity duration-500"></div>

          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-cyan-400/10 rounded-full filter blur-3xl -translate-x-1/2 -translate-y-1/2 z-0"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-cyan-300/10 rounded-full filter blur-3xl translate-x-1/3 translate-y-1/3 z-0"></div>

          {/* Carousel Container */}
          <div className="relative z-10 p-6 sm:p-8">
            <BootcampCarousel />
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

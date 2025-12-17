"use client"
import type React from "react"
import { useRef } from "react"
import type { Locale } from "../../../i18n-config"
import { useEffect, useState, useCallback } from "react"
import type { Dictionary } from "@/app/types/dictionary"
import { useLanguage } from "@/app/context/language-context"
import { FadeIn } from "../FadeIn"

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

  const nextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  const goToSlide = (index: number) => {
    setActiveSlide(index)
  }

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevSlide()
      else if (e.key === "ArrowRight") nextSlide()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextSlide, prevSlide])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 50) nextSlide()
    if (touchStart - touchEnd < -50) prevSlide()
  }

  const handleMouseEnter = () => setIsAutoPlaying(false)
  const handleMouseLeave = () => setIsAutoPlaying(true)

  return (
    <div
      className="relative overflow-hidden bg-neutral-900 border border-neutral-800"
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
      {/* Progress bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-neutral-800 z-20">
        <div
          className="h-full bg-cyan-500 transition-all duration-500"
          style={{ width: `${((activeSlide + 1) / images.length) * 100}%` }}
        />
      </div>

      {/* Slides container */}
      <div className="relative w-full h-full">
        {images.map((image, index) => (
          <div
            key={`bootcamp-slide-${index}`}
            className={`absolute inset-0 transition-opacity duration-700 ${
              index === activeSlide ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
            aria-hidden={index !== activeSlide}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} of ${images.length}: ${image.alt}`}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${image.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Caption - only on first slide */}
            {index === 0 && (
              <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center bg-cyan-500 text-white px-4 py-2 text-sm font-bold tracking-wider mb-4">
                    <div className="w-2 h-2 bg-white rounded-full mr-2" />
                    STARTUP BOOTCAMP
                  </div>
                  <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
                    Early-Stage Program
                  </h3>
                  <p className="text-white/90 text-base sm:text-lg leading-relaxed">
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
      <div className="absolute bottom-8 left-0 right-0 flex justify-between items-center px-8 z-30">
        {/* Slide counter */}
        <div className="bg-white text-neutral-900 px-4 py-2 text-sm font-bold">
          <span>{activeSlide + 1}</span>
          <span className="text-neutral-400 mx-1">/</span>
          <span className="text-neutral-500">{images.length}</span>
        </div>

        {/* Pagination dots */}
        <div className="flex items-center justify-center space-x-3">
          {images.map((_, index) => (
            <button
              key={`bootcamp-dot-${index}`}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                index === activeSlide
                  ? "w-8 h-2 bg-cyan-500"
                  : "w-2 h-2 bg-white/60 hover:bg-white"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeSlide ? "true" : "false"}
            />
          ))}
        </div>

        {/* Auto-play toggle */}
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="bg-white text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 p-3"
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
        className="absolute left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white text-neutral-900 flex items-center justify-center z-20 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Previous slide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white text-neutral-900 flex items-center justify-center z-20 hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Next slide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

export default function SDOHStartupBootcamp({ locale, dict }: SDOHStartupBootcampProps) {
  const { dictionary } = useLanguage()
  const [key, setKey] = useState(0)

  useEffect(() => {
    setKey((prev) => prev + 1)
  }, [locale, dict])

  const d = dictionary?.sdoh?.bootcamp ||
    dict?.sdoh?.bootcamp || {
      title: "Startup Bootcamp",
      subtitle: "Early-Stage Program",
      description:
        "A hands-on, early-stage program that helps local entrepreneurs turn ideas into action. Participants receive guidance on business models, impact measurement, funding strategies, and how to build solutions that address real community needs.",
      keyFocus: "Key Focus:",
      keyFocusDescription:
        "Participants received hands-on mentorship, networking opportunities, and practical tools to build solutions addressing real community health needs.",
    }

  const getStringValue = (value: any): string => {
    if (typeof value === "string") return value
    return String(value || "")
  }

  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24 py-8 sm:py-12">
      {/* Title Section */}
      <FadeIn>
        <div className="relative text-center">
          {/* Component Number */}
          <div className="relative inline-block mb-8">
            <div className="relative w-20 h-20 bg-neutral-900 text-white flex items-center justify-center">
              <span className="text-3xl font-black">2</span>
              {/* Accent corner */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-cyan-500" />
            </div>
          </div>

          {/* Title */}
          <div className="relative max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none mb-6 text-neutral-900">
              {getStringValue(d.title)}
            </h2>
            {/* Accent underline */}
            <div className="mx-auto w-24 h-1 bg-cyan-500 mb-8" />
            <p className="text-lg sm:text-xl md:text-2xl text-neutral-600 font-medium leading-relaxed max-w-3xl mx-auto">
              {locale === "es"
                ? "Descubre el segundo componente de nuestro programa integral"
                : "Discover the second component of our comprehensive program"}
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Content Section - Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text Content */}
        <FadeIn>
          <div className="order-2 md:order-1 space-y-8">
            {/* Subtitle badge */}
            <div className="inline-flex items-center px-4 py-2 bg-neutral-100 border border-neutral-200 text-neutral-800 text-sm font-bold">
              <div className="w-2 h-2 bg-cyan-500 rounded-full mr-3" />
              {getStringValue(d.subtitle)}
            </div>

            {/* Main description */}
            <div className="relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
              <p className="text-lg md:text-xl text-neutral-700 leading-relaxed pl-6">
                {getStringValue(d.description)}
              </p>
            </div>

            {/* Feature highlight box */}
            <div className="relative p-8 bg-neutral-50 border border-neutral-200">
              {/* Accent line */}
              <div className="absolute left-0 top-0 w-1 h-full bg-yellow-400" />
              <p className="text-lg leading-relaxed text-neutral-700 pl-4">
                <span className="font-bold text-neutral-900">{getStringValue(d.keyFocus)}</span>{" "}
                {getStringValue(d.keyFocusDescription)}
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Image Carousel */}
        <FadeIn>
          <div className="order-1 md:order-2 relative">
            <BootcampCarousel />
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

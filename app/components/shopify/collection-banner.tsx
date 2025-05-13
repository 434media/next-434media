"use client"
import Image from "next/image"
import type React from "react"

import { useState, useRef, useEffect } from "react"
import { isVideoUrl } from "../../lib/collection-images"
import { motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import Link from "next/link"

interface CollectionBannerProps {
  title: string
  description: string
  imageSrc: string
  ctaText?: string
  ctaLink?: string
  overlayPosition?: "center" | "left" | "right"
  textColor?: string
  buttonStyle?: "primary" | "secondary" | "outline" | "transparent" | "custom"
  customButtonClasses?: string
  logoSrc?: string
  logoWidth?: number
  logoHeight?: number
  scrollToProducts?: boolean
  hideDownArrow?: boolean
  hideText?: boolean
}

export function CollectionBanner({
  title,
  description,
  imageSrc,
  ctaText = "Shop Now",
  ctaLink,
  overlayPosition = "center",
  textColor = "white",
  buttonStyle = "primary",
  customButtonClasses,
  logoSrc,
  logoWidth = 300,
  logoHeight = 150,
  scrollToProducts = false,
  hideDownArrow = false,
  hideText = false,
}: CollectionBannerProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideo = isVideoUrl(imageSrc)
  const hasLogo = Boolean(logoSrc)

  // Handle video loading
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.addEventListener("loadeddata", () => {
        setVideoLoaded(true)
      })

      videoRef.current.addEventListener("error", () => {
        setImageError(true)
      })
    }
  }, [isVideo])

  // Fallback to placeholder if there's an error loading the image or video
  const fallbackSrc = `/placeholder.svg?height=600&width=1600&text=${encodeURIComponent(title)}`
  const finalImageSrc = imageError ? fallbackSrc : imageSrc

  // Handle video loading with optimized strategy
  useEffect(() => {
    if (isVideo && videoRef.current) {
      // Set a timeout to force show video after a reasonable time
      const timeoutId = setTimeout(() => {
        if (!videoLoaded) {
          setVideoLoaded(true)
        }
      }, 1000) // Show video after 1 second even if not fully loaded

      // Event listeners for video loading
      const handleCanPlay = () => {
        setVideoLoaded(true)
        clearTimeout(timeoutId)
      }

      const handleError = () => {
        setImageError(true)
        clearTimeout(timeoutId)
      }

      videoRef.current.addEventListener("canplay", handleCanPlay)
      videoRef.current.addEventListener("loadeddata", handleCanPlay)
      videoRef.current.addEventListener("error", handleError)

      // Try to manually load the video
      videoRef.current.load()

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener("canplay", handleCanPlay)
          videoRef.current.removeEventListener("loadeddata", handleCanPlay)
          videoRef.current.removeEventListener("error", handleError)
        }
        clearTimeout(timeoutId)
      }
    }
  }, [isVideo, videoLoaded])

  // Determine overlay position classes
  const overlayPositionClasses = {
    center: "items-center text-center",
    left: "items-start text-left pl-8 md:pl-16",
    right: "items-end text-right pr-8 md:pr-16",
  }[overlayPosition]

  // Determine button style classes
  const buttonClasses =
    buttonStyle === "custom"
      ? customButtonClasses || "bg-black/40 backdrop-blur-sm text-white border border-white/30 hover:bg-white/10"
      : {
          primary: "bg-white text-black hover:bg-gray-200",
          secondary: "bg-black text-white hover:bg-gray-800",
          outline: "bg-transparent border-2 border-white text-white hover:bg-white/10",
          transparent: "bg-transparent border border-white/50 text-white hover:bg-white/10 backdrop-blur-sm",
        }[buttonStyle]

  // Function to scroll to products section
  const scrollToProductsSection = () => {
    const productsSection = document.querySelector(".products-section")
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: "smooth" })
    }
  }

  // Button click handler
  const handleButtonClick = (e: React.MouseEvent) => {
    if (scrollToProducts) {
      e.preventDefault()
      scrollToProductsSection()
    }
  }

  return (
    <motion.div
      className="relative h-[100vh] min-h-[350px] lg:-mt-26 w-full overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background media - either video or image */}
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            src={finalImageSrc}
            poster={fallbackSrc} // Show static image while video loads
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={finalImageSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          {/* Loading placeholder for video */}
          {!videoLoaded && (
            <div className="absolute inset-0 bg-neutral-800">
              {/* Static placeholder instead of animation */}
              <Image
                src={fallbackSrc || "/placeholder.svg"}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
        </>
      ) : (
        <>
          <Image
            src={finalImageSrc || fallbackSrc}
            alt=""
            fill
            className={`object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            priority
            sizes="100vw"
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true)
              setImageLoaded(true)
            }}
          />
          {/* Loading placeholder for image */}
          {!imageLoaded && <div className="absolute inset-0 bg-neutral-800 animate-pulse" />}
        </>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/30" />

      {/* Content container with text overlay or logo */}
      <div className={`absolute inset-0 flex flex-col justify-center ${overlayPositionClasses}`}>
        <div className="max-w-3xl px-6 py-8 md:px-8">
          {hasLogo ? (
            <motion.div
              className="mb-8 flex justify-center mt-0 md:mt-12 lg:mt-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src={logoSrc || "/placeholder.svg"}
                alt={title}
                width={logoWidth}
                height={logoHeight}
                className="max-w-full h-auto md:w-[400px] lg:w-[500px]"
                priority
                onLoad={() => setLogoLoaded(true)}
                onError={() => {
                  console.error("Logo failed to load:", logoSrc)
                  setLogoError(true)
                }}
              />
            </motion.div>
          ) : !hideText ? (
            <>
              <motion.h1
                className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-${textColor}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {title}
              </motion.h1>

              <motion.p
                className={`text-lg md:text-xl mb-8 text-${textColor}/90 max-w-xl`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {description}
              </motion.p>
            </>
          ) : null}

          {ctaText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex justify-center"
            >
              {scrollToProducts ? (
                <button
                  onClick={handleButtonClick}
                  className={`inline-block px-8 py-3 rounded-md font-medium text-base transition-all duration-200 ${buttonClasses}`}
                >
                  {ctaText}
                </button>
              ) : (
                <Link
                  href={ctaLink || "#"}
                  className={`inline-block px-8 py-3 rounded-md font-medium text-base transition-all duration-200 ${buttonClasses}`}
                >
                  {ctaText}
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Visual indicator positioned at the bottom - only if not hidden */}
      {!hideDownArrow && (
        <motion.div
          className="absolute bottom-8 left-0 right-0 flex justify-center w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div
            className="text-white opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={scrollToProductsSection}
          >
            <span className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <ChevronDown className="w-6 h-6" aria-hidden="true" />
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
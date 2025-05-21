"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { ShoppingBag, ArrowDown } from "lucide-react"
import clsx from "clsx"

interface CollectionBannerProps {
  title: string
  description?: string
  image?: string
  ctaText?: string
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
  customAnimation?: "none" | "fade" | "slide" | "zoom" | "pulse"
  videoOverlay?: string
}

export function CollectionBanner({
  title,
  description,
  image,
  ctaText = "Shop Now", // Default to "Shop Now"
  overlayPosition = "center",
  textColor = "text-white",
  buttonStyle = "primary",
  customButtonClasses = "",
  logoSrc,
  logoWidth = 200,
  logoHeight = 100,
  hideText = true, // Default to true - hide text overlay
  customAnimation = "fade",
  videoOverlay,
}: CollectionBannerProps) {
  const [, setMediaLoaded] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const isVideo = image ? /\.(mp4|webm|ogg)$/i.test(image) : false
  const isMounted = useRef(true)
  const playAttempted = useRef(false)

  // Handle scroll to products section
  const handleScrollToProducts = () => {
    const productsSection = document.getElementById("products-section")
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: "smooth" })
    }
  }

  // Set up cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }, [])

  // Handle video loading and playback with improved error handling
  useEffect(() => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current

      const handleCanPlay = () => {
        if (!isMounted.current) return

        setMediaLoaded(true)

        // Only attempt to play if we haven't already tried
        if (!playAttempted.current) {
          playAttempted.current = true

          // Use a timeout to avoid rapid play/pause calls
          setTimeout(() => {
            if (isMounted.current && videoRef.current) {
              videoRef.current.play().catch((error) => {
                console.error("Video play failed:", error)
                if (isMounted.current) {
                  setMediaError(true)
                }
              })
            }
          }, 100)
        }
      }

      const handleError = (e: Event) => {
        console.error("Video error:", e)
        if (isMounted.current) {
          setMediaError(true)
        }
      }

      // Clean up any existing listeners
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("error", handleError)

      // Add event listeners
      video.addEventListener("canplay", handleCanPlay)
      video.addEventListener("error", handleError)

      // Set video attributes
      video.muted = true
      video.playsInline = true
      video.loop = true
      video.autoplay = true

      // Force load the video
      video.load()

      return () => {
        video.removeEventListener("canplay", handleCanPlay)
        video.removeEventListener("error", handleError)

        // Ensure we pause the video on cleanup to avoid memory leaks
        try {
          video.pause()
        } catch (e) {
          console.error("Error pausing video:", e)
        }
      }
    }
  }, [isVideo, image])

  // Handle image loading
  const handleImageLoad = () => {
    if (isMounted.current) {
      setMediaLoaded(true)
    }
  }

  // Handle image error
  const handleImageError = () => {
    console.error("Image failed to load:", image)
    if (isMounted.current) {
      setMediaError(true)
    }
  }

  // Get button classes based on style
  const getButtonClasses = (style: string, custom?: string) => {
    switch (style) {
      case "primary":
        return "bg-white text-black hover:bg-gray-200"
      case "secondary":
        return "bg-black text-white hover:bg-gray-800"
      case "outline":
        return "bg-transparent border border-white text-white hover:bg-white/10"
      case "transparent":
        return "bg-transparent text-white hover:bg-white/10"
      case "custom":
        return custom || ""
      default:
        return "bg-white text-black hover:bg-gray-200"
    }
  }

  // Get overlay position classes
  const getOverlayPositionClasses = () => {
    switch (overlayPosition) {
      case "left":
        return "items-start text-left pl-8 md:pl-16"
      case "right":
        return "items-end text-right pr-8 md:pr-16"
      case "center":
      default:
        return "items-center text-center"
    }
  }

  // Get animation variants based on customAnimation
  const getAnimationVariants = () => {
    switch (customAnimation) {
      case "none":
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
        }
      case "slide":
        return {
          initial: { opacity: 0, y: 50 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -50 },
        }
      case "zoom":
        return {
          initial: { opacity: 0, scale: 1.1 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 },
        }
      case "pulse":
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: {
            type: "spring",
            stiffness: 300,
            damping: 30,
          },
        }
      case "fade":
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
    }
  }

  // Get logo animation variants
  const logoVariants = {
    initial: { opacity: 0, y: -20, scale: 0.9 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        delay: 0.2,
        type: "spring",
        stiffness: 200,
        damping: 20,
      },
    },
  }

  // Get button animation variants
  const buttonVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: 0.5,
        type: "spring",
        stiffness: 200,
        damping: 15,
      },
    },
    hover: {
      scale: 1.05,
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: {
        duration: 0.2,
      },
    },
    tap: {
      scale: 0.95,
    },
  }

  return (
    <div ref={bannerRef} className="relative w-full overflow-hidden bg-neutral-900 aspect-[16/9] md:aspect-[21/9]">
      {/* Background Media */}
      <div className="absolute inset-0 bg-neutral-900">
        <AnimatePresence>
          {isVideo && image ? (
            <motion.div
              {...getAnimationVariants()}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-neutral-900"
            >
              <video
                ref={videoRef}
                muted
                playsInline
                loop
                autoPlay
                className="h-full w-full object-cover"
                poster="/placeholder.svg?height=600&width=1600&text=Loading..."
              >
                <source src={image} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Video overlay for better text visibility */}
              {videoOverlay && <div className="absolute inset-0" style={{ backgroundColor: videoOverlay }} />}

              {/* Fallback for video error */}
              {mediaError && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80">
                  <button
                    onClick={() => {
                      if (videoRef.current && isMounted.current) {
                        // Reset play attempted flag
                        playAttempted.current = false

                        // Reset error state
                        setMediaError(false)

                        // Reload and play with a slight delay
                        videoRef.current.load()
                        setTimeout(() => {
                          if (videoRef.current && isMounted.current) {
                            videoRef.current.play().catch((e) => {
                              console.error("Play failed:", e)
                              if (isMounted.current) {
                                setMediaError(true)
                              }
                            })
                          }
                        }, 100)
                      }
                    }}
                    className="rounded-full bg-white/20 p-4 backdrop-blur-sm transition-all hover:bg-white/30"
                    aria-label="Play video"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-white"
                    >
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </button>
                </div>
              )}
            </motion.div>
          ) : image ? (
            <motion.div
              {...getAnimationVariants()}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-neutral-900"
            >
              <Image
                src={image || "/placeholder.svg"}
                alt={title}
                fill
                priority
                className="object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Subtle gradient overlay for better button visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div
        className={clsx(
          "relative z-10 flex h-full w-full flex-col justify-center p-6",
          getOverlayPositionClasses(),
          textColor,
        )}
      >
        {/* Logo */}
        {logoSrc && (
          <motion.div
            variants={logoVariants}
            initial="initial"
            animate="animate"
            className="mb-6 max-w-xs mx-auto"
            style={{ maxWidth: `${logoWidth}px` }}
          >
            <Image
              src={logoSrc || "/placeholder.svg"}
              alt={`${title} logo`}
              width={logoWidth}
              height={logoHeight}
              className="h-auto w-full object-contain"
              priority
            />
          </motion.div>
        )}

        {/* Text Content - Hidden by default */}
        {!hideText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-2xl mx-auto md:mx-0"
          >
            <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">{title}</h1>
            {description && <p className="mb-6 text-base md:text-lg opacity-90">{description}</p>}
          </motion.div>
        )}

        {/* Shop Now Button - Always visible */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          variants={buttonVariants}
          initial="initial"
          animate="animate"
          whileHover="hover"
          whileTap="tap"
        >
          <button
            onClick={handleScrollToProducts}
            className={clsx(
              "flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-200 shadow-lg backdrop-blur-sm",
              "border border-white/20",
              getButtonClasses(buttonStyle, customButtonClasses),
            )}
            aria-label="Shop Now"
          >
            <ShoppingBag size={18} />
            {ctaText}
            <ArrowDown size={16} className="ml-1" />
          </button>
        </motion.div>
      </div>
    </div>
  )
}

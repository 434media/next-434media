"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import clsx from "clsx"

interface CollectionBannerProps {
  title: string
  description?: string
  image?: string
  video?: string
  logo?: string
  className?: string
  imageClassName?: string
  textClassName?: string
  logoClassName?: string
  isFullHeight?: boolean
  isVideo?: boolean
  isOverlay?: boolean
  isTextCentered?: boolean
  isTextLeft?: boolean
  isTextRight?: boolean
  isTextBottom?: boolean
  isTextTop?: boolean
  isTextOverlay?: boolean
  isTextOverlayBottom?: boolean
  isTextOverlayTop?: boolean
  isTextOverlayLeft?: boolean
  isTextOverlayRight?: boolean
  isTextOverlayCentered?: boolean
  isLogoOverlay?: boolean
  isLogoOverlayBottom?: boolean
  isLogoOverlayTop?: boolean
  isLogoOverlayLeft?: boolean
  isLogoOverlayRight?: boolean
  isLogoOverlayCentered?: boolean
  isLogoBottom?: boolean
  isLogoTop?: boolean
  isLogoLeft?: boolean
  isLogoRight?: boolean
  isLogoCentered?: boolean
}

export function CollectionBanner({
  title,
  description,
  image,
  video,
  logo,
  className,
  imageClassName,
  textClassName,
  logoClassName,
  isFullHeight = false,
  isVideo = false,
  isOverlay = false,
  isTextCentered = false,
  isTextLeft = false,
  isTextRight = false,
  isTextBottom = false,
  isTextTop = false,
  isTextOverlay = false,
  isTextOverlayBottom = false,
  isTextOverlayTop = false,
  isTextOverlayLeft = false,
  isTextOverlayRight = false,
  isTextOverlayCentered = false,
  isLogoOverlay = false,
  isLogoOverlayBottom = false,
  isLogoOverlayTop = false,
  isLogoOverlayLeft = false,
  isLogoOverlayRight = false,
  isLogoOverlayCentered = false,
  isLogoBottom = false,
  isLogoTop = false,
  isLogoLeft = false,
  isLogoRight = false,
  isLogoCentered = false,
}: CollectionBannerProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timeoutId = useRef<NodeJS.Timeout | undefined>(undefined)

  // Set a timeout to handle slow-loading or failed media
  useEffect(() => {
    timeoutId.current = setTimeout(() => {
      if (!imageLoaded && !videoLoaded) {
        setImageError(true)
      }
    }, 5000)

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current)
      }
    }
  }, [imageLoaded, videoLoaded])

  // Handle video loading
  useEffect(() => {
    if (isVideo && videoRef.current) {
      const video = videoRef.current

      // Event listeners for video loading
      const handleCanPlay = () => {
        setVideoLoaded(true)
        clearTimeout(timeoutId.current)
      }

      const handleError = () => {
        setImageError(true)
        clearTimeout(timeoutId.current)
      }

      video.addEventListener("canplay", handleCanPlay)
      video.addEventListener("loadeddata", handleCanPlay)
      video.addEventListener("error", handleError)

      // Try to manually load the video
      video.load()

      return () => {
        video.removeEventListener("canplay", handleCanPlay)
        video.removeEventListener("loadeddata", handleCanPlay)
        video.removeEventListener("error", handleError)
        clearTimeout(timeoutId.current)
      }
    }
  }, [isVideo, videoLoaded])

  // Handle image loading
  const handleImageLoad = () => {
    setImageLoaded(true)
    clearTimeout(timeoutId.current)
  }

  // Handle image error
  const handleImageError = () => {
    setImageError(true)
    clearTimeout(timeoutId.current)
  }

  // Handle logo loading
  const handleLogoLoad = () => {}

  // Handle logo error
  const handleLogoError = (error: any) => {
    console.error("Error loading logo:", error)
  }

  return (
    <div
      className={clsx(
        "relative w-full overflow-hidden bg-neutral-900",
        isFullHeight ? "h-[80vh]" : "aspect-[21/9] md:aspect-[21/9]",
        className,
      )}
    >
      {/* Background Media */}
      <div className="absolute inset-0 bg-neutral-900">
        {isVideo && video ? (
          <div className="absolute inset-0 bg-neutral-900">
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className={clsx(
                "h-full w-full object-cover transition-opacity duration-500",
                videoLoaded ? "opacity-100" : "opacity-0",
                imageClassName,
              )}
            >
              <source src={video} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          image && (
            <div className="absolute inset-0 bg-neutral-900">
              <Image
                src={image || "/placeholder.svg"}
                alt={title}
                fill
                priority
                className={clsx(
                  "object-cover transition-opacity duration-500",
                  imageLoaded ? "opacity-100" : "opacity-0",
                  imageClassName,
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </div>
          )
        )}

        {/* Overlay */}
        {isOverlay && <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center p-6 text-center text-white">
        {/* Logo */}
        {logo && (
          <div
            className={clsx(
              "mb-6 w-full max-w-[200px]",
              isLogoOverlay && "absolute z-20",
              isLogoOverlayBottom && "bottom-6",
              isLogoOverlayTop && "top-6",
              isLogoOverlayLeft && "left-6 text-left",
              isLogoOverlayRight && "right-6 text-right",
              isLogoOverlayCentered && "left-1/2 -translate-x-1/2",
              isLogoBottom && "mt-auto",
              isLogoTop && "mb-auto",
              isLogoLeft && "mr-auto text-left",
              isLogoRight && "ml-auto text-right",
              isLogoCentered && "mx-auto",
              logoClassName,
            )}
          >
            <Image
              src={logo || "/placeholder.svg"}
              alt={`${title} logo`}
              width={200}
              height={100}
              className="h-auto w-full object-contain"
              onLoad={handleLogoLoad}
              onError={handleLogoError}
            />
          </div>
        )}

        {/* Text Content */}
        <AnimatePresence>
          {(imageLoaded || videoLoaded || imageError) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={clsx(
                "w-full max-w-4xl",
                isTextOverlay && "absolute z-20",
                isTextOverlayBottom && "bottom-6",
                isTextOverlayTop && "top-6",
                isTextOverlayLeft && "left-6 text-left",
                isTextOverlayRight && "right-6 text-right",
                isTextOverlayCentered && "left-1/2 -translate-x-1/2",
                isTextBottom && "mt-auto",
                isTextTop && "mb-auto",
                isTextLeft && "mr-auto text-left",
                isTextRight && "ml-auto text-right",
                isTextCentered && "mx-auto text-center",
                textClassName,
              )}
            >
              <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">{title}</h1>
              {description && <p className="mx-auto max-w-2xl text-base text-neutral-200 md:text-lg">{description}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

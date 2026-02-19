"use client"
import { useState } from "react"
import { motion } from "motion/react"
import type { Collection } from "../../lib/shopify/types"
import Link from "next/link"
import Image from "next/image"
import { useMediaQuery } from "../../hooks/use-mobile"

interface FrameProps {
  collection: Collection
  index: number
  collectionImage?: string
}

export function Frame({ collection, index, collectionImage }: FrameProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Use the collection image or fallback to placeholder
  const imageSrc =
    imageError || !collectionImage
      ? `/placeholder.svg?height=600&width=400&text=${encodeURIComponent(collection.title)}`
      : collectionImage

  // Frame animation variants - simplified for better performance
  const frameVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
    hover: {
      scale: 1.03,
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
  }

  // Get frame colors that match the application's theme
  const getFrameStyle = (idx: number) => {
    const styles = [
      "border-neutral-800 bg-emerald-600", // Primary emerald
      "border-neutral-800 bg-neutral-900", // Dark neutral
      "border-neutral-800 bg-emerald-700", // Darker emerald
      "border-neutral-800 bg-neutral-800", // Medium neutral
    ]
    return styles[idx % styles.length]
  }

  // Determine the correct path for the collection
  const collectionPath = collection.path

  return (
    <motion.div
      variants={frameVariants}
      initial="hidden"
      animate="visible"
      whileHover={isMobile ? undefined : "hover"}
      whileTap={isMobile ? { scale: 0.98 } : undefined}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="aspect-[3/4] w-full h-full mx-auto"
    >
      <Link
        href={collectionPath}
        className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-sm"
        aria-label={`View ${collection.title} collection`}
        prefetch={true} // Enable prefetching for instant navigation
      >
        <div
          className={`relative h-full w-full overflow-hidden rounded-sm border-[6px] shadow-lg ${getFrameStyle(index)}`}
          style={{
            boxShadow: "0 6px 12px -2px rgba(0, 0, 0, 0.3), 0 3px 7px -3px rgba(0, 0, 0, 0.2)",
          }}
        >
          {/* Loading skeleton */}
          {isLoading && <div className="absolute inset-[3px] bg-neutral-200 animate-pulse" aria-hidden="true" />}

          {/* Collection image */}
          <div className="absolute inset-[3px] overflow-hidden bg-white">
            <Image
              src={imageSrc || "/placeholder.svg"}
              alt={`${collection.title} collection featured image`}
              fill
              className={`object-cover transition-transform duration-700 ease-in-out ${
                isHovered && !isMobile ? "scale-105" : "scale-100"
              }`}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 80vw"
              onError={() => setImageError(true)}
              onLoad={() => setIsLoading(false)}
              priority={index < 2} // Prioritize loading the first two images
            />

            {/* Overlay gradient */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80"
              aria-hidden="true"
            />

            {/* Collection title */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 p-3"
              animate={isHovered && !isMobile ? { y: -5 } : { y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-center text-base font-bold text-white drop-shadow-md sm:text-lg">
                {collection.title}
              </h2>

              <motion.div
                initial={{ width: "0%" }}
                animate={isHovered && !isMobile ? { width: "40%" } : { width: "0%" }}
                className="mx-auto mt-1 h-0.5 bg-emerald-400"
                transition={{ duration: 0.3 }}
                aria-hidden="true"
              />
            </motion.div>

            {/* Hover indicator - with accessibility improvements - only on non-mobile */}
            {isHovered && !isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 transform text-center"
                aria-hidden="true" // Hide from screen readers as it's decorative
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-black">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true" // Hide from screen readers as it's decorative
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, useAnimation, useInView } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Collection } from "../../lib/shopify/types"
import { useMobile } from "../../hooks/use-mobile"
import { InteractiveRoom } from "./interactive-room"

interface HotspotProps {
  x: string
  y: string
  size: number
  label: string
  collection: Collection
  onClick: () => void
  index: number
}

const Hotspot = ({ x, y, size, label, collection, onClick, index }: HotspotProps) => {
  const controls = useAnimation()
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    // Pulse animation - make it more subtle but always visible
    controls.start({
      scale: [1, 1.1, 1],
      opacity: [0.9, 1, 0.9],
      transition: {
        duration: 3,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "loop",
        ease: "easeInOut",
        delay: index * 0.2,
      },
    })
  }, [controls, index])

  return (
    <div className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, zIndex: 30 }}>
      <motion.button
        className="relative group"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        initial={{ scale: 1 }}
        animate={controls}
        whileHover={{ scale: 1.3 }}
        whileTap={{ scale: 0.9 }}
        aria-label={`View ${collection.title} collection`}
      >
        {/* Outer ring - more like a glowing border */}
        <motion.div
          className="absolute rounded-full backdrop-blur-sm"
          style={{
            width: size * 1.4, // Reduced from 2.2 to 1.4
            height: size * 1.4, // Reduced from 2.2 to 1.4
            top: -size * 0.2, // Adjusted for proper centering
            left: -size * 0.2, // Adjusted for proper centering
          }}
          animate={{
            scale: isHovered ? 1.2 : 1,
            opacity: isHovered ? 0.9 : 0.7, // Increased default opacity for better visibility
            backgroundColor: isHovered ? "rgba(52, 211, 153, 0.5)" : "rgba(16, 185, 129, 0.4)",
            boxShadow: isHovered ? "0 0 20px rgba(52, 211, 153, 0.6)" : "0 0 12px rgba(16, 185, 129, 0.5)", // Enhanced glow
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Inner circle - brighter and more visible */}
        <motion.div
          className="rounded-full flex items-center justify-center"
          style={{ width: size, height: size }}
          animate={{
            scale: isHovered ? 1.1 : 1,
            backgroundColor: isHovered ? "#34d399" : "#10b981", // emerald-400 when hovered, emerald-500 default
            boxShadow: isHovered ? "0 0 20px rgba(52, 211, 153, 0.7)" : "0 0 10px rgba(16, 185, 129, 0.5)",
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.span className="text-white text-xs font-bold" animate={{ scale: isHovered ? 1.2 : 1 }}>
            +
          </motion.span>
        </motion.div>
      </motion.button>

      {/* Tooltip - Show on hover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg whitespace-nowrap"
            style={{ zIndex: 40 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-emerald-400">View Collection</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CollectionCardProps {
  collection: Collection
  onClose: () => void
  isVisible: boolean
}

const CollectionCard = ({ collection, onClose, isVisible }: CollectionCardProps) => {
  const router = useRouter()

  const handleViewCollection = () => {
    router.push(collection.path)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 50 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="bg-neutral-900 rounded-xl overflow-hidden shadow-2xl max-w-md w-full relative"
            style={{ zIndex: 51 }}
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 overflow-hidden">
              {collection.image?.url ? (
                <Image
                  src={collection.image.url || "/placeholder.svg?height=400&width=600&text=Collection"}
                  alt={collection.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-900 to-emerald-600 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{collection.title}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
                aria-label="Close"
              >
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
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">{collection.title}</h3>
              <p className="text-neutral-300 text-sm mb-6">
                {collection.description || `Explore our ${collection.title} collection and discover amazing products.`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleViewCollection}
                  className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-500 transition-colors"
                >
                  View Collection
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-3 border border-neutral-600 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface InteractiveShopHeroProps {
  frameOneCollection: Collection
  frameTwoCollection: Collection
  computerCollection: Collection
  boxingCollection: Collection
}

export function InteractiveShopHero({
  frameOneCollection,
  frameTwoCollection,
  computerCollection,
  boxingCollection,
}: InteractiveShopHeroProps) {
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [imageError, setImageError] = useState(false)
  const roomRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(roomRef, { once: false, amount: 0.1 })
  const controls = useAnimation()
  const isMobile = useMobile()
  const [hasAnimated, setHasAnimated] = useState(false)

  // If mobile, render the mobile component instead
  const renderMobileComponent = isMobile

  useEffect(() => {
    if (renderMobileComponent) {
      return
    }

    if (isInView && !hasAnimated) {
      controls.start({
        opacity: 1,
        scale: 1,
        transition: {
          duration: 0.8,
          ease: "easeOut",
        },
      })
      setHasAnimated(true)
    }
  }, [isInView, controls, hasAnimated, renderMobileComponent])

  if (renderMobileComponent) {
    return (
      <InteractiveRoom
        frameOneCollection={frameOneCollection}
        frameTwoCollection={frameTwoCollection}
        computerCollection={computerCollection}
        boxingCollection={boxingCollection}
      />
    )
  }

  // Define hotspot positions (percentages for responsive positioning)
  const hotspots = [
    {
      x: "31%",
      y: "31%", // Adjusted from 30%
      size: 32,
      label: "TXMX BOXING",
      collection: boxingCollection,
    },
    {
      x: "50%",
      y: "36%", // Adjusted from 35%
      size: 32,
      label: "434 MEDIA",
      collection: frameOneCollection,
    },
    {
      x: "66%",
      y: "30%", // Adjusted from 30%
      size: 32,
      label: "VemosVamos",
      collection: frameTwoCollection,
    },
    {
      x: "83%",
      y: "45%", // This one can stay the same
      size: 32,
      label: "DEVSA",
      collection: computerCollection,
    },
  ]

  const handleHotspotClick = (collection: Collection) => {
    setActiveCollection(collection)
  }

  const handleCloseModal = () => {
    setActiveCollection(null)
  }

  const handleImageLoad = () => {
    console.log("Shop hero image loaded successfully")
    setIsLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    console.error("Failed to load shop hero image, using fallback")
    setImageError(true)
    setIsLoaded(true) // Still mark as loaded so UI doesn't hang
  }

  // Fallback image URL for when the main image fails to load
  const fallbackImageUrl = "/placeholder.svg?height=800&width=1200&text=Interactive+Shop"

  // Use a reliable image URL or placeholder
  const imageUrl = imageError ? fallbackImageUrl : "https://ampd-asset.s3.us-east-2.amazonaws.com/434Shop2Upscale.png"

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-950 pt-16 md:pt-20">
      {/* Desktop version (non-scrollable) */}
      <motion.div
        ref={roomRef}
        className="relative w-full h-full"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={controls}
      >
        {/* Show loading state while image is loading */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}

        {/* Main background image */}
        <div className="absolute inset-0 bg-neutral-900">
          {!imageError ? (
            <Image
              src={imageUrl || "/placeholder.svg"}
              alt="Interactive shop display with product collections"
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <p className="text-white text-center px-4 text-xl">
                Explore our interactive collections by clicking the highlighted points
              </p>
            </div>
          )}
        </div>

        {/* Overlay gradient for better text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {/* Hotspots */}
        <div className="absolute inset-0 pointer-events-none">
          {hotspots.map((hotspot, index) => (
            <div key={index} className="pointer-events-auto">
              <Hotspot
                x={hotspot.x}
                y={hotspot.y}
                size={hotspot.size}
                label={hotspot.label}
                collection={hotspot.collection}
                onClick={() => handleHotspotClick(hotspot.collection)}
                index={index}
              />
            </div>
          ))}
        </div>

        {/* Intro text */}
        <motion.div
          className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-white"
          style={{ zIndex: 20 }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
            delay: 0.8,
          }}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 max-w-2xl">Explore Our Collections</h1>
          <p className="text-lg sm:text-xl text-neutral-200 max-w-md mb-6">
            Click on the highlighted points to discover our featured products and collections
          </p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              href="/search"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
            >
              Browse All Products
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
              >
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Collection modal */}
      <CollectionCard
        collection={activeCollection || frameOneCollection}
        onClose={handleCloseModal}
        isVisible={activeCollection !== null}
      />
    </div>
  )
}

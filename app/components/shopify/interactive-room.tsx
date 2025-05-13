"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, useAnimation, useInView } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Collection } from "../../lib/shopify/types"
import { ChevronLeft, ChevronRight } from "lucide-react"

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
    // Pulse animation
    controls.start({
      scale: [1, 1.2, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "loop",
        ease: "easeInOut",
        delay: index * 0.3,
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
        {/* Outer ring */}
        <motion.div
          className="absolute rounded-full backdrop-blur-sm"
          style={{
            width: size * 1.4, // Reduced from 2.0 to 1.4
            height: size * 1.4, // Reduced from 2.0 to 1.4
            top: -size * 0.2, // Adjusted for proper centering
            left: -size * 0.2, // Adjusted for proper centering
          }}
          animate={{
            scale: isHovered ? 1.2 : 1,
            opacity: isHovered ? 0.8 : 0.7, // Increased default opacity for better visibility
            backgroundColor: isHovered ? "rgba(52, 211, 153, 0.5)" : "rgba(16, 185, 129, 0.4)",
            boxShadow: isHovered ? "0 0 20px rgba(52, 211, 153, 0.6)" : "0 0 12px rgba(16, 185, 129, 0.5)", // Enhanced glow
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Inner circle */}
        <motion.div
          className="rounded-full flex items-center justify-center"
          style={{ width: size, height: size }}
          animate={{
            scale: isHovered ? 1.1 : 1,
            backgroundColor: isHovered ? "#34d399" : "#10b981", // emerald-400 when hovered, emerald-500 default
            boxShadow: isHovered ? "0 0 20px rgba(52, 211, 153, 0.7)" : "0 0 10px rgba(16, 185, 129, 0.3)",
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.span className="text-white text-xs font-bold" animate={{ scale: isHovered ? 1.2 : 1 }}>
            +
          </motion.span>
        </motion.div>
      </motion.button>

      {/* Tooltip */}
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

// Mobile scroll indicator component
const MobileScrollIndicator = () => {
  const [showIndicator, setShowIndicator] = useState(true)

  useEffect(() => {
    // Hide the indicator after 8 seconds (increased from 5)
    const timer = setTimeout(() => {
      setShowIndicator(false)
    }, 8000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {showIndicator && (
        <motion.div
          className="fixed top-1/2 left-0 right-0 flex justify-center items-center z-40 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="bg-black/80 backdrop-blur-sm text-white px-5 py-3 rounded-full flex items-center gap-3 shadow-lg"
            animate={{ x: [0, -15, 0, 15, 0] }}
            transition={{
              repeat: 5, // Increased from 3
              duration: 2,
              ease: "easeInOut",
            }}
          >
            <ChevronLeft size={18} />
            <span className="text-sm font-medium">Scroll to explore</span>
            <ChevronRight size={18} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface InteractiveRoomProps {
  frameOneCollection: Collection
  frameTwoCollection: Collection
  computerCollection: Collection
  boxingCollection: Collection
}

export function InteractiveRoom({
  frameOneCollection,
  frameTwoCollection,
  computerCollection,
  boxingCollection,
}: InteractiveRoomProps) {
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(roomRef, { once: false, amount: 0.1 })
  const controls = useAnimation()

  // Define hotspot positions (percentages for responsive positioning)
  const hotspots = [
    {
      x: "25%",
      y: "40%",
      size: 24,
      label: "TXMX BOXING",
      collection: boxingCollection,
    },
    {
      x: "50%",
      y: "46%",
      size: 24,
      label: "434 MEDIA",
      collection: frameOneCollection,
    },
    {
      x: "70%",
      y: "44%",
      size: 24,
      label: "VemosVamos",
      collection: frameTwoCollection,
    },
    {
      x: "90%",
      y: "52%", // Adjusted from 65% to 45% for better visibility
      size: 24,
      label: "DEVSA",
      collection: computerCollection,
    },
  ]

  // Handle animation when component comes into view
  useEffect(() => {
    if (isInView) {
      controls.start({
        opacity: 1,
        scale: 1,
        transition: {
          duration: 0.8,
          ease: "easeOut",
        },
      })
    }
  }, [isInView, controls])

  // Set initial scroll position to the right side when component mounts
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Set scroll position to show the right side of the image (computerCollection)
      // We use a small timeout to ensure the container has been properly rendered
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          // Scroll to 75% of the scrollable width to show the right side (computerCollection)
          const scrollAmount = scrollContainerRef.current.scrollWidth * 0.75
          scrollContainerRef.current.scrollTo({
            left: scrollAmount,
            behavior: "auto", // Use 'auto' for immediate positioning without animation
          })
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleHotspotClick = (collection: Collection) => {
    setActiveCollection(collection)
  }

  const handleCloseModal = () => {
    setActiveCollection(null)
  }

  const handleImageLoad = () => {
    console.log("Interactive room image loaded successfully")
    setIsLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    console.error("Failed to load interactive room image, using fallback")
    setImageError(true)
    setIsLoaded(true) // Still mark as loaded so UI doesn't hang
  }

  // Fallback image URL for when the main image fails to load
  const fallbackImageUrl = "/placeholder.svg?height=800&width=1200&text=Interactive+Room"

  // Use a more reliable image URL that works on both desktop and mobile
  // Using a direct CDN URL that should be more reliable
  const imageUrl = "https://ampd-asset.s3.us-east-2.amazonaws.com/434Shop2Upscale.png"

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-950">
      {/* Mobile scrollable container */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none", // Hide scrollbar in Firefox
          msOverflowStyle: "none", // Hide scrollbar in IE/Edge
        }}
      >
        <div className="relative w-[250vw] h-full flex">
          <motion.div ref={roomRef} className="relative w-full h-full" initial={{ opacity: 0 }} animate={controls}>
            {/* Show loading state while image is loading */}
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
              </div>
            )}

            {/* Main background image - wider for scrolling */}
            <div className="relative w-[250vw] h-full mt-16 overflow-visible">
              <Image
                src={imageError ? fallbackImageUrl : imageUrl}
                alt="Interactive room with workspace and construction area"
                fill
                priority
                className="object-cover object-center"
                sizes="250vw"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </div>

            {/* Overlay gradient for better text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

            {/* Hotspots - Always visible */}
            <div className="absolute inset-0 pointer-events-none" style={{ width: "250vw" }}>
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

            {/* Mobile scroll indicator */}
            <MobileScrollIndicator />

            {/* Intro text - fixed position for mobile */}
            <motion.div
              className="fixed left-0 right-0 bottom-0 p-6 text-white"
              style={{ zIndex: 20 }}
              initial={{ y: 100, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
                delay: 0.8,
              }}
            >
              <h1 className="text-2xl font-bold mb-2 max-w-xs">Explore Our Interactive Collections</h1>
              <p className="text-sm text-neutral-200 max-w-xs mb-4">
                Tap the hotspots to discover our featured collections
              </p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{ delay: 1.2, duration: 0.5 }}
              >
                <Link
                  href="/search"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  Browse All Products
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
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
        </div>
      </div>

      {/* Collection modal */}
      <CollectionCard
        collection={activeCollection || frameOneCollection}
        onClose={handleCloseModal}
        isVisible={activeCollection !== null}
      />
    </div>
  )
}
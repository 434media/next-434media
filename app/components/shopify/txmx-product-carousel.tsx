"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Image from "next/image"
import Link from "next/link"
import type { Product } from "../../../app/lib/shopify/types"

interface ProductImageCarouselProps {
  products: Product[]
}

export function ProductImageCarousel({ products }: ProductImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Collect all images from all products
  const allImages = products.flatMap((product) =>
    product.images.map((image) => ({
      ...image,
      productHandle: product.handle,
      productTitle: product.title,
    })),
  )

  // Auto-advance carousel
  useEffect(() => {
    if (allImages.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length)
    }, 4000) // Change image every 4 seconds

    return () => clearInterval(interval)
  }, [allImages.length])

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % allImages.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
  }

  if (allImages.length === 0) {
    return (
      <div className="aspect-square relative bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">No images available</p>
      </div>
    )
  }

  return (
    <div className="aspect-square relative overflow-hidden group/carousel">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1, rotateY: 10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.9, rotateY: -10 }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="absolute inset-0"
        >
          <Image
            src={allImages[currentIndex]?.url || "/placeholder.svg?height=400&width=400"}
            alt={allImages[currentIndex]?.altText || "Product image"}
            fill
            className="object-cover group-hover:invert transition-all duration-500"
            sizes="(max-width: 768px) 100vw, 400px"
            priority={currentIndex === 0}
          />
        </motion.div>
      </AnimatePresence>

      {/* Enhanced Gradient Overlay with Animation */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "linear-gradient(to top, rgba(0,0,0,0.3), transparent, transparent)",
            "linear-gradient(to top, rgba(0,0,0,0.5), transparent, transparent)",
            "linear-gradient(to top, rgba(0,0,0,0.3), transparent, transparent)",
          ],
        }}
        transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
      />

      {/* Enhanced Shine Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12"
        animate={{ x: ["-120%", "120%"] }}
        transition={{
          duration: 4,
          repeat: Number.POSITIVE_INFINITY,
          repeatDelay: 3,
          ease: "easeInOut",
        }}
      />

      {/* Navigation Arrows with TXMX Theme Styling */}
      {allImages.length > 1 && (
        <>
          <motion.button
            onClick={prevImage}
            className="absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 border-2 border-white bg-black text-white p-1.5 lg:p-2 opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 z-10 hover:bg-white hover:text-black"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ x: -10 }}
            animate={{ x: 0 }}
          >
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          <motion.button
            onClick={nextImage}
            className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 border-2 border-white bg-black text-white p-1.5 lg:p-2 opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 z-10 hover:bg-white hover:text-black"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ x: 10 }}
            animate={{ x: 0 }}
          >
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </>
      )}

      {/* Enhanced Dots Indicator with TXMX Theme */}
      {allImages.length > 1 && (
        <div className="absolute bottom-2 lg:bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 lg:space-x-2 z-10">
          {allImages.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2.5 h-2.5 lg:w-3 lg:h-3 border-2 border-white transition-all duration-300 ${
                index === currentIndex ? "bg-white" : "bg-black hover:bg-white/50"
              }`}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.8 }}
              animate={{
                scale: index === currentIndex ? 1.2 : 1,
                opacity: index === currentIndex ? 1 : 0.7,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProductInfoSidebarProps {
  products: Product[]
}

// Helper function to truncate description - now uses CSS classes for responsive behavior
function truncateDescription(description: string, maxLength = 100): string {
  if (description.length <= maxLength) return description
  return description.substring(0, maxLength).trim() + "..."
}

export function ProductInfoSidebar({ products }: ProductInfoSidebarProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentProduct, setCurrentProduct] = useState(products[0])

  // Collect all images from all products to sync with carousel
  const allImages = products.flatMap((product) =>
    product.images.map((image) => ({
      ...image,
      productHandle: product.handle,
      productTitle: product.title,
    })),
  )

  // Auto-advance to sync with carousel
  useEffect(() => {
    if (allImages.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [allImages.length])

  // Update current product when image changes
  useEffect(() => {
    const currentImage = allImages[currentIndex]
    if (currentImage) {
      const product = products.find((p) => p.handle === currentImage.productHandle)
      if (product) {
        setCurrentProduct(product)
      }
    }
  }, [currentIndex, allImages, products])

  if (!currentProduct) return null

  return (
    <motion.div
      className="space-y-4 lg:space-y-6 text-white w-full"
      key={currentProduct.handle}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Product Title - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="text-center lg:text-left"
      >
        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-white leading-tight">
          {currentProduct.title}
        </h1>
        <motion.div
          className="h-0.5 lg:h-1 bg-gradient-to-r from-white via-white/60 to-transparent mt-2 lg:mt-3 mx-auto lg:mx-0 w-3/4 lg:w-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        />
      </motion.div>

      {/* Product Description - Mobile Optimized with CSS-based responsive truncation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="space-y-2 lg:space-y-3 text-center lg:text-left"
      >
        {/* Mobile description - shorter */}
        <p className="text-sm sm:text-base lg:text-lg text-white/80 leading-relaxed max-w-full lg:max-w-lg mx-auto lg:mx-0 block sm:hidden">
          {truncateDescription(currentProduct.description, 85)}
        </p>
        {/* Desktop description - longer */}
        <p className="text-sm sm:text-base lg:text-lg text-white/80 leading-relaxed max-w-full lg:max-w-lg mx-auto lg:mx-0 hidden sm:block">
          {truncateDescription(currentProduct.description, 162)}
        </p>
      </motion.div>

      {/* Price - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="relative text-center lg:text-left"
      >
        <div className="inline-block">
          <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            ${currentProduct.priceRange.minVariantPrice.amount}
          </span>
          <motion.div
            className="absolute -bottom-1 lg:-bottom-2 left-0 h-0.5 bg-white w-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />
        </div>
      </motion.div>

      {/* Add to Cart Button - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="w-full"
      >
        <Link href={`/product/${currentProduct.handle}`} className="block w-full">
          <motion.div
            className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-2 border-white bg-black relative overflow-hidden group cursor-pointer focus-within:ring-2 focus-within:ring-white/50 focus-within:ring-offset-2 focus-within:ring-offset-black w-full"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Sliding Background Effect - Exact same as drop badge */}
            <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

            <motion.span className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black tracking-wider relative z-10 group-hover:text-black transition-colors duration-500 block text-center text-white">
              ADD TO CART
            </motion.span>
          </motion.div>
        </Link>
      </motion.div>
    </motion.div>
  )
}

// Legacy components for backward compatibility
interface ProductInfoProps {
  products: Product[]
}

export function ProductInfo({ products }: ProductInfoProps) {
  return <ProductInfoSidebar products={products} />
}

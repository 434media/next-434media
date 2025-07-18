"use client"

import { AddToCart } from "../cart/add-to-cart"
import Prose from "../prose"
import type { Product } from "../../../lib/shopify/types"
import { VariantSelector } from "./variant-selector"
import { motion } from "motion/react"
import { useProduct } from "./product-context"
import { useEffect, useState } from "react"
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react"

interface QuantitySelectorProps {
  quantity: number
  onQuantityChange: (quantity: number) => void
}

function QuantitySelector({ quantity, onQuantityChange }: QuantitySelectorProps) {
  return (
    <div className="mb-8">
      <dt className="mb-4">
        <span className="text-xl md:text-2xl uppercase tracking-wider font-black text-white">Quantity</span>
      </dt>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          className="border-2 border-white bg-black text-white hover:bg-white hover:text-black transition-all duration-300 w-12 h-12 flex items-center justify-center font-black text-xl"
          disabled={quantity <= 1}
        >
          -
        </button>
        <span className="text-2xl font-black text-white min-w-[3rem] text-center">{quantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(quantity + 1)}
          className="border-2 border-white bg-black text-white hover:bg-white hover:text-black transition-all duration-300 w-12 h-12 flex items-center justify-center font-black text-xl"
        >
          +
        </button>
      </div>
    </div>
  )
}

interface ProductDescriptionProps {
  product: Product
  isDesktop?: boolean
}

export function ProductDescription({ product, isDesktop = false }: ProductDescriptionProps) {
  const { state } = useProduct()
  const [selectionComplete, setSelectionComplete] = useState(false)
  const [missingOptions, setMissingOptions] = useState<string[]>([])
  const [quantity, setQuantity] = useState(1)
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false)

  // Update selection validation
  useEffect(() => {
    // Find all required options (excluding color since we're hiding it)
    const requiredOptions = product.options
      .filter((option) => option.name.toLowerCase() !== "color")
      .map((option) => option.name.toLowerCase())

    // Check which options are missing
    const missing = requiredOptions.filter((option) => !state[option])
    setMissingOptions(missing)
    setSelectionComplete(missing.length === 0)
  }, [state, product.options])

  // Create a truncated version of the description (first 150 characters)
  const createTruncatedText = (html: string, maxLength = 150) => {
    // Strip HTML tags for character counting
    const textOnly = html.replace(/<[^>]*>/g, "")
    if (textOnly.length <= maxLength) return html

    // Find a good breaking point (end of sentence or word)
    const truncated = textOnly.substring(0, maxLength)
    const lastPeriod = truncated.lastIndexOf(".")
    const lastSpace = truncated.lastIndexOf(" ")

    const breakPoint = lastPeriod > maxLength - 50 ? lastPeriod + 1 : lastSpace
    const finalText = textOnly.substring(0, breakPoint) + "..."

    return finalText
  }

  const truncatedText = product.descriptionHtml ? createTruncatedText(product.descriptionHtml) : ""
  const needsTruncation = product.descriptionHtml ? product.descriptionHtml.replace(/<[^>]*>/g, "").length > 150 : false

  if (isDesktop) {
    // Desktop layout - return the product selection controls
    return (
      <motion.div
        className="flex flex-col h-full text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Product Title Only - TXMX Style (Price Removed) */}
        <div className="mb-6 pb-4 border-b-2 border-white">
          <motion.h1
            className="text-2xl md:text-3xl lg:text-4xl font-black tracking-wider text-white uppercase leading-tight"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {product.title}
          </motion.h1>
        </div>

        {/* Product Description - Desktop with Dropdown (Replaces Size Selection) */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {product.descriptionHtml ? (
            <div className="border-2 border-white bg-black">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-black tracking-wider uppercase text-white">Product Details</h3>
                  {needsTruncation && (
                    <button
                      onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                      className="text-white transition-colors duration-300 flex items-center gap-2"
                      aria-expanded={isDescriptionOpen}
                      aria-controls="desktop-product-description-content"
                    >
                      <span className="text-sm font-medium">{isDescriptionOpen ? "Show Less" : "Show More"}</span>
                      {isDescriptionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                <div id="desktop-product-description-content">
                  {!isDescriptionOpen && needsTruncation ? (
                    <div className="text-base leading-relaxed font-medium text-white">{truncatedText}</div>
                  ) : (
                    <motion.div
                      initial={needsTruncation ? { height: 0, opacity: 0 } : { opacity: 1 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <Prose
                        className="text-base leading-relaxed font-medium text-white"
                        html={product.descriptionHtml}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Selection guidance with TXMX styling - ALWAYS VISIBLE */}
        <motion.div
          className="mb-6 border-2 border-white bg-black p-4 relative overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="relative z-10 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5 text-white" />
            <div>
              <p className="font-black text-lg tracking-wide uppercase text-white">
                {selectionComplete
                  ? "Size & Quantity Selected"
                  : `Select ${missingOptions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(" & ")}`}
              </p>
              <p className="mt-1 text-sm opacity-80 font-medium text-white">
                {selectionComplete ? "Ready to add to cart" : "Choose all options before adding to cart"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Variant Selector (Size only, Color hidden) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <VariantSelector options={product.options} variants={product.variants} hideColorOption={true} />
        </motion.div>

        {/* Quantity Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <QuantitySelector quantity={quantity} onQuantityChange={setQuantity} />
        </motion.div>

        {/* Add to Cart Button - TXMX Style with extra bottom margin */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <AddToCart product={product} isTXMXStyle={true} quantity={quantity} />
        </motion.div>
      </motion.div>
    )
  }

  // Mobile/tablet layout - full product info with dropdown description
  return (
    <motion.div
      className="flex flex-col text-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Product Title Only - TXMX Style (Price Removed) */}
      <div className="mb-6 pb-4 border-b-2 border-white">
        <motion.h1
          className="text-2xl md:text-3xl lg:text-4xl font-black tracking-wider text-white uppercase leading-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {product.title}
        </motion.h1>
      </div>

      {/* Product Description - Mobile with Dropdown - MOVED UP */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {product.descriptionHtml ? (
          <div className="border-2 border-white bg-black">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black tracking-wider uppercase text-white">Product Details</h3>
                {needsTruncation && (
                  <button
                    onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                    className="text-white hover:text-gray-300 transition-colors duration-300 flex items-center gap-2"
                    aria-expanded={isDescriptionOpen}
                    aria-controls="mobile-product-description-content"
                  >
                    <span className="text-sm font-medium">{isDescriptionOpen ? "Show Less" : "Show More"}</span>
                    {isDescriptionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>

              <div id="mobile-product-description-content">
                {!isDescriptionOpen && needsTruncation ? (
                  <div className="text-base leading-relaxed font-medium text-white">{truncatedText}</div>
                ) : (
                  <motion.div
                    initial={needsTruncation ? { height: 0, opacity: 0 } : { opacity: 1 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <Prose
                      className="text-base leading-relaxed font-medium text-white"
                      html={product.descriptionHtml}
                    />
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>

      {/* Selection guidance with TXMX styling - ALWAYS VISIBLE */}
      <motion.div
        className="mb-6 border-2 border-white bg-black p-4 relative overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="relative z-10 flex items-start gap-3">
          <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5 text-white" />
          <div>
            <p className="font-black text-lg tracking-wide uppercase text-white">
              {selectionComplete
                ? "Size & Quantity Selected"
                : `Select ${missingOptions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(" & ")}`}
            </p>
            <p className="mt-1 text-sm opacity-80 font-medium text-white">
              {selectionComplete ? "Ready to add to cart" : "Choose all options before adding to cart"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Variant Selector (Size only, Color hidden) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <VariantSelector options={product.options} variants={product.variants} hideColorOption={true} />
      </motion.div>

      {/* Quantity Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <QuantitySelector quantity={quantity} onQuantityChange={setQuantity} />
      </motion.div>

      {/* Add to Cart Button - TXMX Style with extra bottom margin */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <AddToCart product={product} isTXMXStyle={true} quantity={quantity} />
      </motion.div>
    </motion.div>
  )
}

// Desktop product description component - no longer needed since it's integrated above
export function DesktopProductDescription({ product }: { product: Product }) {
  return null // This component is no longer used
}

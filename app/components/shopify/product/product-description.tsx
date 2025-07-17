"use client"

import { AddToCart } from "../cart/add-to-cart"
import Price from "../price"
import Prose from "../prose"
import type { Product } from "../../../lib/shopify/types"
import { VariantSelector } from "./variant-selector"
import { motion } from "motion/react"
import { useProduct } from "./product-context"
import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"

export function ProductDescription({ product }: { product: Product }) {
  const { state } = useProduct()
  const [selectedPrice, setSelectedPrice] = useState({
    amount: product.priceRange.maxVariantPrice.amount,
    currencyCode: product.priceRange.maxVariantPrice.currencyCode,
  })
  const [selectionComplete, setSelectionComplete] = useState(false)
  const [missingOptions, setMissingOptions] = useState<string[]>([])

  // Check if this product has size-based pricing
  const hasSizeBasedPricing = product.variants.some((variant, i, arr) => {
    if (i === 0) return false

    const sizeOption = variant.selectedOptions.find((opt) => opt.name.toLowerCase() === "size")
    if (!sizeOption) return false

    // Make sure we have a previous variant to compare with
    const prevVariant = arr[i - 1]
    if (!prevVariant) return false

    const prevSizeOption = prevVariant.selectedOptions.find((opt) => opt.name.toLowerCase() === "size")
    if (!prevSizeOption) return false

    return variant.price.amount !== prevVariant.price.amount
  })

  // Update price based on selected variant
  useEffect(() => {
    // Find all required options
    const requiredOptions = product.options.map((option) => option.name.toLowerCase())

    // Check which options are missing
    const missing = requiredOptions.filter((option) => !state[option])
    setMissingOptions(missing)
    setSelectionComplete(missing.length === 0)

    // Find matching variant based on selected options
    if (Object.keys(state).length > 0) {
      const selectedVariant = product.variants.find((variant) => {
        return variant.selectedOptions.every((option) => {
          const optionName = option.name.toLowerCase()
          return state[optionName] === option.value
        })
      })

      if (selectedVariant) {
        setSelectedPrice({
          amount: selectedVariant.price.amount,
          currencyCode: selectedVariant.price.currencyCode,
        })
      }
    }
  }, [state, product.variants, product.options])

  return (
    <motion.div
      className="flex flex-col h-full text-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Product Title and Price - TXMX Style */}
      <div className="mb-8 pb-6 border-b-2 border-white">
        <motion.h1
          className="mb-4 text-3xl md:text-4xl lg:text-5xl font-black tracking-wider text-white uppercase leading-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {product.title}
        </motion.h1>

        <motion.div
          className="inline-block border-2 border-white bg-black px-4 py-2 relative overflow-hidden group"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="relative z-10 group-hover:text-black transition-colors duration-300">
            <Price
              amount={selectedPrice.amount}
              currencyCode={selectedPrice.currencyCode}
              className="text-2xl md:text-3xl font-black tracking-wider"
            />
          </div>
        </motion.div>
      </div>

      {/* Selection guidance with TXMX styling */}
      {!selectionComplete && (
        <motion.div
          className="mb-6 border-2 border-white bg-black p-4 relative overflow-hidden group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          <div className="relative z-10 flex items-start gap-3 group-hover:text-black transition-colors duration-500">
            <AlertCircle className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-lg tracking-wide uppercase">
                Select {missingOptions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(" & ")}
              </p>
              <p className="mt-1 text-sm opacity-80 font-medium">Choose all options before adding to cart</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Variant Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <VariantSelector
          options={product.options}
          variants={product.variants}
          hasSizeBasedPricing={hasSizeBasedPricing}
        />
      </motion.div>

      {/* Product Description */}
      <motion.div
        className="mb-8 flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        {product.descriptionHtml ? (
          <div className="border-2 border-white bg-black p-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            <div className="relative z-10 group-hover:text-black transition-colors duration-500">
              <Prose
                className="text-base md:text-lg leading-relaxed font-medium group-hover:text-black transition-colors duration-500"
                html={product.descriptionHtml}
              />
            </div>
          </div>
        ) : null}
      </motion.div>

      {/* Add to Cart Button - TXMX Style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <AddToCart product={product} isTXMXStyle={true} />
      </motion.div>
    </motion.div>
  )
}

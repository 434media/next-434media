"use client"

import { AddToCart } from "../../components/cart/add-to-cart"
import Price from "../../components/price"
import Prose from "../../components/prose"
import type { Product } from "../../lib/shopify/types"
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
      className="flex flex-col h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex flex-col border-b border-neutral-700 pb-6">
        <h1 className="mb-2 text-2xl md:text-3xl font-medium text-white">{product.title}</h1>
        <div className="mr-auto rounded-full bg-emerald-600 p-2 text-sm text-white">
          <Price amount={selectedPrice.amount} currencyCode={selectedPrice.currencyCode} />
        </div>
      </div>

      {/* Selection guidance */}
      {!selectionComplete && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-neutral-800/50 p-3 text-sm text-neutral-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-medium">
              Please select {missingOptions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(" & ")} to continue
            </p>
            <p className="mt-1 text-neutral-400">You must choose all options before adding to cart</p>
          </div>
        </div>
      )}

      <VariantSelector
        options={product.options}
        variants={product.variants}
        hasSizeBasedPricing={hasSizeBasedPricing}
      />

      <div className="mb-6 flex-grow overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
        {product.descriptionHtml ? (
          <Prose className="text-sm md:text-base leading-relaxed text-neutral-300" html={product.descriptionHtml} />
        ) : null}
      </div>

      <AddToCart product={product} />
    </motion.div>
  )
}
"use client"

import { useActionState } from "react"
import { motion } from "motion/react"
import type { Product, ProductVariant } from "../../../lib/shopify/types"
// import type { MetaPixelAddToCartData } from "../../../types/meta-pixel"
import clsx from "clsx"
import { addItem } from "./actions"
import { useProduct } from "../product/product-context"
import { useCart } from "./cart-context"

// Generate a unique event ID for deduplication
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function SubmitButton({
  availableForSale,
  selectedVariantId,
  isPending,
  isTXMXStyle = false,
  quantity = 1,
  product,
  variant,
}: {
  availableForSale: boolean
  selectedVariantId: string | undefined
  isPending: boolean
  isTXMXStyle?: boolean
  quantity?: number
  product: Product
  variant?: ProductVariant
}) {
  const handleAddToCart = () => {
    if (!variant || !selectedVariantId) return

    // Check if this is a TXMX product
    const isTXMXProduct =
      product.tags?.some((tag) => tag.toLowerCase().includes("txmx") || tag.toLowerCase().includes("boxing")) ||
      product.productType?.toLowerCase().includes("boxing")

    if (isTXMXProduct) {
      // Track add to cart event for TXMX products
      const eventId = generateEventId()

      // Client-side Meta Pixel event
      // if (typeof window !== "undefined" && window.fbq) {
      //   const eventData: MetaPixelAddToCartData = {
      //     content_ids: [product.id],
      //     content_type: "product",
      //     content_name: product.title,
      //     content_category: "txmx-boxing",
      //     value: Number.parseFloat(variant.price.amount) * quantity,
      //     currency: variant.price.currencyCode,
      //     num_items: quantity,
      //   }

      //   // Fixed: Use options object for eventID
      //   window.fbq("track", "AddToCart", eventData, { eventID: eventId })
      // }

      // Server-side Conversions API event
      // fetch("/api/meta/txmx/add-to-cart", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     eventId,
      //     productId: product.id,
      //     productTitle: product.title,
      //     productHandle: product.handle,
      //     variantId: selectedVariantId,
      //     variantTitle: variant.title,
      //     quantity,
      //     value: Number.parseFloat(variant.price.amount) * quantity,
      //     currency: variant.price.currencyCode,
      //   }),
      // }).catch((error) => {
      //   console.error("Failed to track add to cart event:", error)
      // })
    }
  }

  if (isTXMXStyle) {
    // TXMX Style - matching the drop date badge
    const buttonClasses =
      "w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-white bg-black relative overflow-hidden group cursor-pointer focus-within:ring-2 focus-within:ring-white/50 focus-within:ring-offset-2 focus-within:ring-offset-black transition-all duration-300"
    const disabledClasses = "cursor-not-allowed opacity-60 hover:opacity-60"

    if (!availableForSale) {
      return (
        <button disabled className={clsx(buttonClasses, disabledClasses)}>
          <span className="text-lg sm:text-xl font-black tracking-wider text-white">OUT OF STOCK</span>
        </button>
      )
    }

    if (!selectedVariantId) {
      return (
        <button aria-label="Please select an option" disabled className={clsx(buttonClasses, disabledClasses)}>
          <span className="text-lg sm:text-xl font-black tracking-wider text-white">ADD TO CART</span>
        </button>
      )
    }

    const buttonText = isPending ? "ADDING..." : quantity > 1 ? `ADD ${quantity} TO CART` : "ADD TO CART"

    const ariaLabel = quantity > 1 ? `Add ${quantity} items to cart` : "Add to cart"

    return (
      <motion.button
        type="submit"
        aria-label={ariaLabel}
        className={clsx(buttonClasses, {
          "cursor-wait": isPending,
        })}
        whileHover={{ scale: isPending ? 1 : 1.02 }}
        whileTap={{ scale: isPending ? 1 : 0.98 }}
        disabled={isPending}
        onClick={handleAddToCart}
      >
        <div className="absolute inset-0 bg-white transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
        <span className="text-lg sm:text-xl font-black tracking-wider relative z-10 text-white group-hover:text-black transition-colors duration-500">
          {buttonText}
        </span>
      </motion.button>
    )
  }

  // Default style for non-TXMX products
  const buttonClasses =
    "relative flex w-full items-center justify-center rounded-full bg-emerald-600 p-4 tracking-wide text-white transition-all duration-300"
  const disabledClasses = "cursor-not-allowed opacity-60 hover:opacity-60"

  if (!availableForSale) {
    return (
      <button disabled className={clsx(buttonClasses, disabledClasses)}>
        Out Of Stock
      </button>
    )
  }

  if (!selectedVariantId) {
    return (
      <button aria-label="Please select an option" disabled className={clsx(buttonClasses, disabledClasses)}>
        <div className="absolute left-0 ml-4">
          <i className="ri-add-line h-5 w-5" aria-hidden="true"></i>
        </div>
        Add To Cart
      </button>
    )
  }

  const buttonText = isPending ? "Adding..." : quantity > 1 ? `Add ${quantity} To Cart` : "Add To Cart"

  const ariaLabel = quantity > 1 ? `Add ${quantity} items to cart` : "Add to cart"

  return (
    <motion.button
      type="submit"
      aria-label={ariaLabel}
      className={clsx(buttonClasses, {
        "hover:bg-emerald-500": !isPending,
        "cursor-wait": isPending,
      })}
      whileHover={{ scale: isPending ? 1 : 1.02 }}
      whileTap={{ scale: isPending ? 1 : 0.98 }}
      disabled={isPending}
      onClick={handleAddToCart}
    >
      <div className="absolute left-0 ml-4">
        {isPending ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          <i className="ri-add-line h-5 w-5" aria-hidden="true"></i>
        )}
      </div>
      {buttonText}
    </motion.button>
  )
}

export function AddToCart({
  product,
  isTXMXStyle = false,
  quantity = 1,
}: {
  product: Product
  isTXMXStyle?: boolean
  quantity?: number
}) {
  const { variants, availableForSale } = product
  const { addCartItem } = useCart()
  const { state } = useProduct()
  const [message, formAction, isPending] = useActionState(addItem, null)

  const variant = variants.find((variant: ProductVariant) =>
    variant.selectedOptions.every((option) => option.value === state[option.name.toLowerCase()]),
  )
  const defaultVariantId = variants.length === 1 ? variants[0]?.id : undefined
  const selectedVariantId = variant?.id || defaultVariantId

  // Find the final variant that will be added to the cart
  const finalVariant = variants.find((v) => v.id === selectedVariantId)

  return (
    <form
      action={async (formData: FormData) => {
        if (finalVariant && selectedVariantId) {
          // Add multiple items based on quantity to local cart context
          for (let i = 0; i < quantity; i++) {
            addCartItem(finalVariant, product)
          }
          // Call the server action with form data
          formAction(formData)
        }
      }}
    >
      {/* Hidden inputs for server action */}
      <input type="hidden" name="selectedVariantId" value={selectedVariantId || ""} />
      <input type="hidden" name="quantity" value={quantity.toString()} />

      <SubmitButton
        availableForSale={availableForSale}
        selectedVariantId={selectedVariantId}
        isPending={isPending || false}
        isTXMXStyle={isTXMXStyle}
        quantity={quantity}
        product={product}
        variant={finalVariant}
      />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  )
}

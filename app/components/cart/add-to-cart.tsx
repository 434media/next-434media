"use client"

import { useActionState } from "react"
import { motion } from "motion/react"
import type { Product, ProductVariant } from "../../lib/shopify/types"
import clsx from "clsx"
import { addItem } from "./actions"
import { useProduct } from "components/product/product-context"
import { useCart } from "./cart-context"

function SubmitButton({
  availableForSale,
  selectedVariantId,
  isPending,
}: {
  availableForSale: boolean
  selectedVariantId: string | undefined
  isPending: boolean
}) {
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

  return (
    <motion.button
      type="submit"
      aria-label="Add to cart"
      className={clsx(buttonClasses, {
        "hover:bg-emerald-500": !isPending,
        "cursor-wait": isPending,
      })}
      whileHover={{ scale: isPending ? 1 : 1.02 }}
      whileTap={{ scale: isPending ? 1 : 0.98 }}
      disabled={isPending}
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
      {isPending ? "Adding..." : "Add To Cart"}
    </motion.button>
  )
}

export function AddToCart({ product }: { product: Product }) {
  const { variants, availableForSale } = product
  const { addCartItem } = useCart()
  const { state } = useProduct()
  const [message, formAction, isPending] = useActionState(addItem, null)

  const variant = variants.find((variant: ProductVariant) =>
    variant.selectedOptions.every((option) => option.value === state[option.name.toLowerCase()]),
  )
  const defaultVariantId = variants.length === 1 ? variants[0]?.id : undefined
  const selectedVariantId = variant?.id || defaultVariantId
  const addItemAction = formAction.bind(null, selectedVariantId)

  // Find the final variant that will be added to the cart
  const finalVariant = variants.find((v) => v.id === selectedVariantId)

  return (
    <form
      action={async () => {
        if (finalVariant && selectedVariantId) {
          addCartItem(finalVariant, product)
          addItemAction()
        }
      }}
    >
      <SubmitButton
        availableForSale={availableForSale}
        selectedVariantId={selectedVariantId}
        isPending={isPending || false}
      />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  )
}
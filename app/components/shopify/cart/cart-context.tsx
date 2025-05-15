"use client"

import type React from "react"

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react"
import type { Cart, Product, ProductVariant } from "../../../lib/shopify/types"

export type UpdateType = "plus" | "minus" | "delete"

interface CartState {
  cart: Cart | undefined
  addCartItem: (variant: ProductVariant, product: Product) => void
  updateCartItem: (merchandiseId: string, updateType: UpdateType) => void
  hasValidCheckout: boolean
}

interface OptimisticAction {
  type: "UPDATE_ITEM" | "ADD_ITEM"
  payload: {
    merchandiseId?: string
    updateType?: UpdateType
    variant?: ProductVariant
    product?: Product
  }
}

const CartContext = createContext<CartState | null>(null)

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }

  return context
}

interface CartProviderProps {
  children: React.ReactNode
  cartPromise: Promise<Cart | undefined>
}

export function CartProvider({ children, cartPromise }: CartProviderProps) {
  const [, setCart] = useState<Cart | undefined>(undefined)
  const [optimisticCart, setOptimisticCart] = useState<Cart | undefined>(undefined)
  const [hasValidCheckout, setHasValidCheckout] = useState(false)

  useEffect(() => {
    cartPromise.then((cart) => {
      setCart(cart)
      setOptimisticCart(cart)
      setHasValidCheckout(Boolean(cart?.checkoutUrl))
    })
  }, [cartPromise])

  const updateOptimisticCart = useCallback(
    (action: OptimisticAction) => {
      if (!optimisticCart) return

      const { type, payload } = action
      const { merchandiseId, updateType, variant, product } = payload

      const newCart = { ...optimisticCart }

      if (type === "UPDATE_ITEM" && merchandiseId && updateType) {
        const lineItem = newCart.lines.find((item) => item.merchandise.id === merchandiseId)

        if (!lineItem) return

        if (updateType === "delete") {
          newCart.lines = newCart.lines.filter((item) => item.merchandise.id !== merchandiseId)
          newCart.totalQuantity = (newCart.totalQuantity || 0) - lineItem.quantity
        } else {
          const quantity = updateType === "plus" ? lineItem.quantity + 1 : lineItem.quantity - 1

          if (quantity <= 0) {
            newCart.lines = newCart.lines.filter((item) => item.merchandise.id !== merchandiseId)
            newCart.totalQuantity = (newCart.totalQuantity || 0) - lineItem.quantity
          } else {
            const updatedLines = newCart.lines.map((item) => {
              if (item.merchandise.id === merchandiseId) {
                return {
                  ...item,
                  quantity,
                }
              }
              return item
            })
            newCart.lines = updatedLines
            newCart.totalQuantity = (newCart.totalQuantity || 0) + (updateType === "plus" ? 1 : -1)
          }
        }
      } else if (type === "ADD_ITEM" && variant && product) {
        // Check if the item already exists in the cart
        const existingItem = newCart.lines.find((item) => item.merchandise.id === variant.id)

        if (existingItem) {
          // Update the quantity of the existing item
          const updatedLines = newCart.lines.map((item) => {
            if (item.merchandise.id === variant.id) {
              return {
                ...item,
                quantity: item.quantity + 1,
              }
            }
            return item
          })
          newCart.lines = updatedLines
        } else {
          // Add the new item to the cart
          const newItem = {
            id: `temp-${Date.now()}`,
            quantity: 1,
            cost: {
              totalAmount: {
                amount: variant.price.amount,
                currencyCode: variant.price.currencyCode,
              },
            },
            merchandise: {
              id: variant.id,
              title: product.title,
              selectedOptions: variant.selectedOptions,
              product: {
                id: product.id, // Added the id property
                title: product.title,
                handle: product.handle,
                featuredImage: product.featuredImage,
              },
            },
          }

          newCart.lines = [...newCart.lines, newItem]
        }

        newCart.totalQuantity = (newCart.totalQuantity || 0) + 1
      }

      setOptimisticCart(newCart)
    },
    [optimisticCart],
  )

  const updateCartItem = useCallback(
    (merchandiseId: string, updateType: UpdateType) => {
      updateOptimisticCart({
        type: "UPDATE_ITEM",
        payload: { merchandiseId, updateType },
      })
    },
    [updateOptimisticCart],
  )

  const addCartItem = useCallback(
    (variant: ProductVariant, product: Product) => {
      updateOptimisticCart({ type: "ADD_ITEM", payload: { variant, product } })
    },
    [updateOptimisticCart],
  )

  const value = useMemo(
    () => ({
      cart: optimisticCart,
      updateCartItem,
      addCartItem,
      hasValidCheckout,
    }),
    [optimisticCart, hasValidCheckout, updateCartItem, addCartItem],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

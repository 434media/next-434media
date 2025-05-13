"use server"

import { TAGS } from "../../../lib/constants"
import { addToCart, createCart, getCart, removeFromCart, updateCart } from "../../../lib/shopify"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function removeItem(_prevState: unknown, merchandiseId: string) {
  try {
    const cart = await getCart()

    if (!cart) {
      return "Error fetching cart"
    }

    const lineItem = cart.lines.find((line) => line.merchandise.id === merchandiseId)

    if (lineItem && lineItem.id) {
      await removeFromCart([lineItem.id])
      revalidateTag(TAGS.cart)
    } else {
      return "Item not found in cart"
    }
  } catch (_e) {
    return "Error removing item from cart"
  }
}

export async function updateItemQuantity(
  _prevState: unknown,
  payload: {
    merchandiseId: string
    quantity: number
  },
) {
  const { merchandiseId, quantity } = payload

  try {
    const cart = await getCart()

    if (!cart) {
      return "Error fetching cart"
    }

    const lineItem = cart.lines.find((line) => line.merchandise.id === merchandiseId)

    if (lineItem && lineItem.id) {
      if (quantity === 0) {
        await removeFromCart([lineItem.id])
      } else {
        await updateCart([
          {
            id: lineItem.id,
            merchandiseId,
            quantity,
          },
        ])
      }
    } else if (quantity > 0) {
      // If the item doesn't exist in the cart and quantity > 0, add it
      await addToCart([{ merchandiseId, quantity }])
    }

    revalidateTag(TAGS.cart)
  } catch (e) {
    console.error(e)
    return "Error updating item quantity"
  }
}

// Update the redirectToCheckout function to handle password-protected stores
export async function redirectToCheckout() {
  const cart = await getCart()

  // Check if cart exists and has a valid checkoutUrl
  if (!cart || !cart.checkoutUrl) {
    console.error("No valid checkout URL found. Creating a new cart...")
    // Create a new cart if one doesn't exist or doesn't have a checkout URL
    const newCart = await createCart()
    if (newCart && newCart.checkoutUrl) {
      // If your store is password protected, you might need to authenticate first
      // For development purposes, you can redirect to the store password page with a return_to parameter
      const checkoutUrl = newCart.checkoutUrl

      // Check if the store domain is in the URL (it should be)
      const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
      if (storeDomain && checkoutUrl.includes(storeDomain)) {
        // Log the checkout URL for debugging
        console.log("Redirecting to checkout URL:", checkoutUrl)
        redirect(checkoutUrl)
      } else {
        console.error("Invalid checkout URL format:", checkoutUrl)
        redirect("/search")
      }
    } else {
      // Fallback to the shop page if we can't get a checkout URL
      console.error("Failed to create a cart with a valid checkout URL")
      redirect("/search")
    }
  } else {
    // Log the checkout URL for debugging
    console.log("Redirecting to existing checkout URL:", cart.checkoutUrl)
    redirect(cart.checkoutUrl)
  }
}

// New function to get checkout URL without redirecting
export async function getCheckoutUrl() {
  const cart = await getCart()

  if (!cart || !cart.checkoutUrl) {
    // Create a new cart if one doesn't exist or doesn't have a checkout URL
    const newCart = await createCart()
    if (newCart && newCart.checkoutUrl) {
      return newCart.checkoutUrl
    }
    return null
  }

  return cart.checkoutUrl
}

export async function createCartAndSetCookie() {
  const cart = await createCart()
  const cookieStore = await cookies()
  cookieStore.set("cartId", cart.id!)
}

export async function addItem(_prevState: unknown, selectedVariantId: string | undefined) {
  if (!selectedVariantId) {
    return "Error adding item to cart"
  }

  try {
    await addToCart([{ merchandiseId: selectedVariantId, quantity: 1 }])
    revalidateTag(TAGS.cart)
  } catch (_e) {
    return "Error adding item to cart"
  }
}

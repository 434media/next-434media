import type React from "react"
import { PublicShell } from "@/components/PublicShell"
import { CartProvider } from "@/components/shopify/cart/cart-context"
import { NavCart } from "@/components/shopify/cart/nav-cart"
import { getCart } from "@/lib/shopify"

/**
 * The store: /shop, /product and /search. The same public shell as (site), plus
 * the cart. getCart() used to sit in the root layout, where — with the geo
 * header read beside it — it made every page dynamic (2b fix 9).
 *
 * The store stays dynamic, as it always was: the cart is per visitor, and
 * getCart()'s cookie read happens inside a promise nothing awaits, so it would
 * not mark these routes dynamic by itself.
 */
export const dynamic = "force-dynamic"

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  // Don't await the fetch, pass the Promise to the context provider
  const cart = getCart()

  return (
    <CartProvider cartPromise={cart}>
      <PublicShell cart={<NavCart />}>{children}</PublicShell>
    </CartProvider>
  )
}

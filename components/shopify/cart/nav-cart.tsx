"use client"

import { useEffect, useState } from "react"
import CartModal from "./modal"

/**
 * The navbar's cart button, rendered only under the (shop) layout.
 *
 * The cart contents are not known to the server, so the button keeps the mount
 * gate it had inside CombinedNavbar.
 */
export function NavCart() {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) return null
  return <CartModal />
}

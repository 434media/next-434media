"use client"

import { removeItem } from "./actions"
import type { CartItem } from "../../../lib/shopify/types"
import { useActionState } from "react"
import type { UpdateType } from "./cart-context"

export function DeleteItemButton({
  item,
  optimisticUpdate,
}: {
  item: CartItem
  optimisticUpdate: (merchandiseId: string, updateType: UpdateType) => void
}) {
  const merchandiseId = item.merchandise.id
  const [message, formAction] = useActionState(removeItem, null)

  return (
    <form
      action={async () => {
        optimisticUpdate(merchandiseId, "delete")
        await formAction(merchandiseId)
      }}
    >
      <button
        type="submit"
        aria-label="Remove cart item"
        className="group relative overflow-hidden flex h-6 w-6 items-center justify-center bg-black border-2 border-white text-white transition-all duration-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1"
      >
        <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
        <i
          className="ri-close-line text-sm text-white group-hover:text-black relative z-10 transition-colors duration-500"
          style={{ lineHeight: 0 }}
          aria-hidden="true"
        ></i>
      </button>
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  )
}

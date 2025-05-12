"use client"

import { removeItem } from "./actions"
import type { CartItem } from "../../lib/shopify/types"
import { useActionState } from "react"

export function DeleteItemButton({
  item,
  optimisticUpdate,
}: {
  item: CartItem
  optimisticUpdate: any
}) {
  const [message, formAction] = useActionState(removeItem, null)
  const merchandiseId = item.merchandise.id
  const removeItemAction = formAction.bind(null, merchandiseId)

  return (
    <form
      action={async () => {
        optimisticUpdate(merchandiseId, "delete")
        removeItemAction()
      }}
    >
      <button
        type="submit"
        aria-label="Remove cart item"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
      >
        <i className="ri-close-line text-sm" style={{ lineHeight: 0 }} aria-hidden="true"></i>
      </button>
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  )
}
"use client"

import clsx from "clsx"
import { updateItemQuantity } from "./actions"
import type { CartItem } from "../../../lib/shopify/types"
import { useActionState } from "react"
import type { UpdateType } from "./cart-context"

function SubmitButton({ type }: { type: "plus" | "minus" }) {
  return (
    <button
      type="submit"
      aria-label={type === "plus" ? "Increase item quantity" : "Reduce item quantity"}
      className={clsx("flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-neutral-800", {
        "ml-auto": type === "minus",
      })}
    >
      {type === "plus" ? (
        <i className="ri-add-line h-4 w-4 text-neutral-300" aria-hidden="true"></i>
      ) : (
        <i className="ri-subtract-line h-4 w-4 text-neutral-300" aria-hidden="true"></i>
      )}
    </button>
  )
}

export function EditItemQuantityButton({
  item,
  type,
  optimisticUpdate,
}: {
  item: CartItem
  type: "plus" | "minus"
  optimisticUpdate: (merchandiseId: string, updateType: UpdateType) => void
}) {
  const [message, formAction] = useActionState(updateItemQuantity, null)
  const payload = {
    merchandiseId: item.merchandise.id,
    quantity: type === "plus" ? item.quantity + 1 : item.quantity - 1,
  }
  const updateItemQuantityAction = formAction.bind(null, payload)

  return (
    <form
      action={async () => {
        optimisticUpdate(payload.merchandiseId, type)
        updateItemQuantityAction()
      }}
    >
      <SubmitButton type={type} />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  )
}

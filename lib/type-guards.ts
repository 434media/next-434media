import type { ShopifyErrorLike } from "./shopify/types"

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isShopifyError(error: unknown): error is ShopifyErrorLike {
  if (!isObject(error)) return false

  return (
    "status" in error && typeof error.status === "number" && "message" in error && typeof error.message === "string"
  )
}

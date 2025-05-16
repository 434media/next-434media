import { type ClassValue, clsx } from "clsx"

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(
  price: number | string,
  options: {
    currency?: "USD" | "EUR" | "GBP" | "BDT"
    notation?: Intl.NumberFormatOptions["notation"]
  } = {},
) {
  const { currency = "USD", notation = "compact" } = options

  const numericPrice = typeof price === "string" ? Number.parseFloat(price) : price

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation,
    maximumFractionDigits: 2,
  }).format(numericPrice)
}

export function ensureStartsWith(stringToCheck: string, startsWith: string) {
  if (!stringToCheck || typeof stringToCheck !== "string") {
    return startsWith
  }

  if (stringToCheck.startsWith(startsWith)) {
    return stringToCheck
  }

  return `${startsWith}${stringToCheck}`
}

export function createUrl(pathname: string, params: URLSearchParams | Record<string, string> = {}) {
  const searchParams =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(Object.entries(params).filter(([_, value]) => value !== undefined))

  const paramsString = searchParams.toString()
  const queryString = paramsString.length > 0 ? `?${paramsString}` : ""

  return `${pathname}${queryString}`
}

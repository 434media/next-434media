import type { ReadonlyURLSearchParams } from "next/navigation"

export const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000"

export const createUrl = (pathname: string, params: URLSearchParams | ReadonlyURLSearchParams) => {
  const paramsString = params.toString()
  const queryString = `${paramsString.length ? "?" : ""}${paramsString}`

  return `${pathname}${queryString}`
}

export const ensureStartsWith = (stringToCheck: string, startsWith: string) =>
  stringToCheck.startsWith(startsWith) ? stringToCheck : `${startsWith}${stringToCheck}`

export const validateEnvironmentVariables = () => {
  const requiredEnvironmentVariables = ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_ACCESS_TOKEN"]
  const missingEnvironmentVariables = [] as string[]

  requiredEnvironmentVariables.forEach((envVar) => {
    if (!process.env[envVar]) {
      missingEnvironmentVariables.push(envVar)
    }
  })

  if (missingEnvironmentVariables.length) {
    throw new Error(
      `The following environment variables are missing. Your site will not work without them. Read more: https://vercel.com/docs/integrations/shopify#configure-environment-variables\n\n${missingEnvironmentVariables.join(
        "\n",
      )}\n`,
    )
  }

  if (process.env.SHOPIFY_STORE_DOMAIN?.includes("[") || process.env.SHOPIFY_STORE_DOMAIN?.includes("]")) {
    throw new Error(
      "Your `SHOPIFY_STORE_DOMAIN` environment variable includes brackets (ie. `[` and / or `]`). Your site will not work with them there. Please remove them.",
    )
  }
}

/**
 * Format a price with the appropriate currency symbol
 * @param amount - The price amount (string or number)
 * @param currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns Formatted price string
 */
export const formatPrice = (amount: string | number, currencyCode = "USD"): string => {
  const numericAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount)
}

/**
 * Format a price range with the appropriate currency symbol
 * @param minPrice - The minimum price in the range
 * @param maxPrice - The maximum price in the range
 * @param currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @returns Formatted price range string
 */
export const formatPriceRange = (
  minPrice: string | number,
  maxPrice: string | number,
  currencyCode = "USD",
): string => {
  const minNumeric = typeof minPrice === "string" ? Number.parseFloat(minPrice) : minPrice
  const maxNumeric = typeof maxPrice === "string" ? Number.parseFloat(maxPrice) : maxPrice

  // If min and max are the same, just return a single price
  if (minNumeric === maxNumeric) {
    return formatPrice(minNumeric, currencyCode)
  }

  // Otherwise, return a price range
  return `${formatPrice(minNumeric, currencyCode)} - ${formatPrice(maxNumeric, currencyCode)}`
}

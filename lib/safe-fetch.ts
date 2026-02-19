import { getCollectionProducts } from "./shopify"
import type { Product } from "./shopify/types"

/**
 * Safely fetch collection products with enhanced error handling
 */
export async function safeGetCollectionProducts({
  collection,
  sortKey = "RELEVANCE",
  reverse = false,
}: {
  collection: string
  sortKey?: string
  reverse?: boolean
}): Promise<Product[]> {
  try {
    // Add logging for debugging
    console.log(`Fetching products for collection: ${collection}`)

    // Check if collection is empty or invalid
    if (!collection || typeof collection !== "string") {
      console.error(`Invalid collection handle: ${collection}`)
      return []
    }

    // Attempt to fetch products
    const products = await getCollectionProducts({ collection, sortKey, reverse })

    // Log success
    console.log(`Successfully fetched ${products.length} products for collection: ${collection}`)

    return products
  } catch (error) {
    // Enhanced error logging
    console.error(`Error fetching collection products for ${collection}:`, error)

    // Check if error is a response error
    if (error && typeof error === "object" && "status" in error) {
      console.error(`API error status: ${(error as any).status}`)
    }

    // Check if it's a network error
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`)
      console.error(`Error stack: ${error.stack}`)
    }

    // Return empty array instead of throwing
    return []
  }
}

import { getCollectionProducts } from "./shopify"
import type { Product } from "./shopify/types"

/**
 * Safely fetch collection products with error handling
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
    const products = await getCollectionProducts({ collection, sortKey, reverse })
    return products
  } catch (error) {
    console.error(`Error fetching collection products for ${collection}:`, error)
    // Return empty array instead of throwing
    return []
  }
}
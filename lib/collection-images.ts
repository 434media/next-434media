// Map collection handles to banner images (for collection pages only)
// These are custom banner images from our Firebase Storage bucket
// Replace the entire collectionBannerImages object with this updated version
export const collectionBannerImages: Record<string, string> = {
  // Default fallback image
  default: "/placeholder.svg?height=600&width=1600&text=Collection",

  // Active collections
  "txmx-boxing": "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/TXMX%20Hero%20Banner.mp4",
  vemosvamos: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/VV%20Web%20Banner%202.mp4",
  milcityusa: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/MilCity.mp4",
  devsa: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/DEVSA%20Web%20Banner.mp4",
  "434-media": "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/MilCity.mp4",

  // Keep some of the original examples for backward compatibility
  frontpage: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
  summer: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
  winter: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
  accessories: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
  "new-arrivals": "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
  featured: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/pexels-bohlemedia-1884584.jpg",
}

// Default fallback image as a constant
const DEFAULT_IMAGE = "/placeholder.svg?height=600&width=1600&text=Collection"

/**
 * Get the banner image URL for a collection
 * @param handle The collection handle
 * @returns The banner image URL
 */
// Update the getCollectionBannerImage function to prioritize txmx-boxing
export function getCollectionBannerImage(handle: string): string {
  // First check if the handle exists in our mapping
  if (handle in collectionBannerImages) {
    return collectionBannerImages[handle] ?? DEFAULT_IMAGE
  }

  // Special case: if handle is "frontpage", use "txmx-boxing" image
  if (handle === "frontpage") {
    return collectionBannerImages["txmx-boxing"] ?? DEFAULT_IMAGE
  }

  // If not, return the default image
  return DEFAULT_IMAGE
}

/**
 * Check if the banner media is a video
 * @param url The media URL
 * @returns True if the URL is a video
 */
export function isVideoUrl(url: string): boolean {
  // Convert to lowercase for case-insensitive comparison
  const lowerUrl = url.toLowerCase()

  // Check for common video extensions
  // Also handle URLs with query parameters
  return (
    lowerUrl.endsWith(".mp4") ||
    lowerUrl.endsWith(".webm") ||
    lowerUrl.endsWith(".mov") ||
    lowerUrl.includes(".mp4?") ||
    lowerUrl.includes(".webm?") ||
    lowerUrl.includes(".mov?")
  )
}

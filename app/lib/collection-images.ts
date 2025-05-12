// Map collection handles to banner images (for collection pages only)
// These are custom banner images from our S3 bucket
// Replace the entire collectionBannerImages object with this updated version
export const collectionBannerImages: Record<string, string> = {
  // Default fallback image
  default: "/placeholder.svg?height=600&width=1600&text=Collection",

  // Active collections
  "txmx-boxing": "https://ampd-asset.s3.us-east-2.amazonaws.com/TXMX+Hero+Banner.mp4",
  vemosvamos: "https://ampd-asset.s3.us-east-2.amazonaws.com/VV+Web+Banner+2.mp4",
  milcityusa: "https://ampd-asset.s3.us-east-2.amazonaws.com/MilCity.mp4",
  devsa: "https://ampd-asset.s3.us-east-2.amazonaws.com/DEVSA+Web+Banner.mp4",
  "434-media": "https://ampd-asset.s3.us-east-2.amazonaws.com/MilCity.mp4",

  // Keep some of the original examples for backward compatibility
  frontpage: "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
  summer: "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
  winter: "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
  accessories: "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
  "new-arrivals": "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
  featured: "https://ampd-asset.s3.us-east-2.amazonaws.com/pexels-bohlemedia-1884584.jpg",
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
  return url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov")
}
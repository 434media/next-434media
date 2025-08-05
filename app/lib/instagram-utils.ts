import type { InstagramMedia, InstagramMediaInsights, InstagramTimeRange } from "../types/instagram-insights"

// Format numbers for display
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

// Format percentage
export function formatPercentage(num: number, decimals = 1): string {
  return `${num.toFixed(decimals)}%`
}

// Calculate engagement rate for a media item
export function calculateMediaEngagementRate(media: InstagramMedia, followerCount: number): number {
  if (followerCount === 0) return 0

  const likes = media.like_count || 0
  const comments = media.comments_count || 0
  const total = likes + comments

  return (total / followerCount) * 100
}

// Calculate engagement rate from insights
export function calculateEngagementRateFromInsights(insights: InstagramMediaInsights, followerCount: number): number {
  if (followerCount === 0) return 0
  return (insights.engagement / followerCount) * 100
}

// Calculate basic engagement rate (for API usage)
export function calculateEngagementRate(engagement: number, reach: number): number {
  if (reach === 0) return 0
  return (engagement / reach) * 100
}

// Get media type display name
export function getMediaTypeDisplayName(mediaType: string): string {
  switch (mediaType) {
    case "IMAGE":
      return "Photo"
    case "VIDEO":
      return "Video"
    case "CAROUSEL_ALBUM":
      return "Carousel"
    case "STORY":
      return "Story"
    default:
      return mediaType
  }
}

// Format Instagram timestamp to readable date
export function formatInstagramDate(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Get relative time (e.g., "2 hours ago")
export function getRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "Just now"
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`
  }

  return formatInstagramDate(timestamp)
}

// Extract hashtags from caption
export function extractHashtags(caption: string): string[] {
  if (!caption) return []

  const hashtagRegex = /#[\w]+/g
  const matches = caption.match(hashtagRegex)
  return matches ? matches.map((tag) => tag.substring(1)) : []
}

// Extract mentions from caption
export function extractMentions(caption: string): string[] {
  if (!caption) return []

  const mentionRegex = /@[\w.]+/g
  const matches = caption.match(mentionRegex)
  return matches ? matches.map((mention) => mention.substring(1)) : []
}

// Calculate growth rate between two values
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// Get growth rate display with color
export function getGrowthRateDisplay(growthRate: number): {
  value: string
  color: "green" | "red" | "gray"
  icon: "up" | "down" | "neutral"
} {
  const formatted = formatPercentage(Math.abs(growthRate))

  if (growthRate > 0) {
    return {
      value: `+${formatted}`,
      color: "green",
      icon: "up",
    }
  } else if (growthRate < 0) {
    return {
      value: `-${formatted}`,
      color: "red",
      icon: "down",
    }
  } else {
    return {
      value: "0%",
      color: "gray",
      icon: "neutral",
    }
  }
}

// Sort media by engagement
export function sortMediaByEngagement(media: InstagramMedia[]): InstagramMedia[] {
  return [...media].sort((a, b) => {
    const aEngagement = (a.like_count || 0) + (a.comments_count || 0)
    const bEngagement = (b.like_count || 0) + (b.comments_count || 0)
    return bEngagement - aEngagement
  })
}

// Sort media by date
export function sortMediaByDate(media: InstagramMedia[], ascending = false): InstagramMedia[] {
  return [...media].sort((a, b) => {
    const aDate = new Date(a.timestamp).getTime()
    const bDate = new Date(b.timestamp).getTime()
    return ascending ? aDate - bDate : bDate - aDate
  })
}

// Get top performing media
export function getTopPerformingMedia(media: InstagramMedia[], limit = 5): InstagramMedia[] {
  return sortMediaByEngagement(media).slice(0, limit)
}

// Calculate average engagement for media array
export function calculateAverageEngagement(media: InstagramMedia[]): number {
  if (media.length === 0) return 0

  const totalEngagement = media.reduce((sum, item) => {
    return sum + (item.like_count || 0) + (item.comments_count || 0)
  }, 0)

  return totalEngagement / media.length
}

// Format date range for API calls
export function formatDateRange(timeRange: InstagramTimeRange): { since: string; until: string } {
  const now = new Date()
  const until = now.toISOString().split("T")[0]

  let daysBack: number
  switch (timeRange) {
    case "1d":
      daysBack = 1
      break
    case "7d":
      daysBack = 7
      break
    case "30d":
      daysBack = 30
      break
    case "90d":
      daysBack = 90
      break
    default:
      daysBack = 7
  }

  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  return { since, until }
}

// Validate Instagram media URL
export function isValidInstagramUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === "www.instagram.com" || urlObj.hostname === "instagram.com"
  } catch {
    return false
  }
}

// Extract Instagram username from URL
export function extractUsernameFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split("/").filter(Boolean)

    if (pathParts.length > 0 && pathParts[0] !== "p" && pathParts[0] !== "reel") {
      return pathParts[0]
    }

    return null
  } catch {
    return null
  }
}

// Generate Instagram media permalink
export function generateInstagramPermalink(mediaId: string): string {
  return `https://www.instagram.com/p/${mediaId}/`
}

// Get boxing-specific hashtags for TXMX content analysis
export function getBoxingHashtags(): string[] {
  return [
    "boxing",
    "boxingtraining",
    "boxinglife",
    "boxinggym",
    "boxingworkout",
    "boxingfitness",
    "boxingcoach",
    "boxingclass",
    "txmxboxing",
    "fightnight",
    "sparring",
    "heavybag",
    "speedbag",
    "shadowboxing",
    "boxinggloves",
    "boxingring",
    "knockout",
    "champion",
    "fighter",
    "combat",
  ]
}

// Analyze caption for boxing-related content
export function analyzeBoxingContent(caption: string): {
  hasBoxingHashtags: boolean
  boxingHashtags: string[]
  isTrainingContent: boolean
  isFightContent: boolean
  isPromotionalContent: boolean
} {
  const boxingHashtags = getBoxingHashtags()
  const captionLower = caption.toLowerCase()
  const captionHashtags = extractHashtags(caption).map((tag) => tag.toLowerCase())

  const foundBoxingHashtags = captionHashtags.filter((tag) => boxingHashtags.includes(tag))

  const trainingKeywords = ["training", "workout", "gym", "practice", "drill", "conditioning"]
  const fightKeywords = ["fight", "bout", "match", "sparring", "round", "knockout"]
  const promotionalKeywords = ["class", "join", "sign up", "membership", "special", "offer"]

  return {
    hasBoxingHashtags: foundBoxingHashtags.length > 0,
    boxingHashtags: foundBoxingHashtags,
    isTrainingContent: trainingKeywords.some((keyword) => captionLower.includes(keyword)),
    isFightContent: fightKeywords.some((keyword) => captionLower.includes(keyword)),
    isPromotionalContent: promotionalKeywords.some((keyword) => captionLower.includes(keyword)),
  }
}

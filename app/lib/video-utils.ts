// Video utility functions for the rich text editor

export interface VideoInfo {
  type: "youtube" | "vimeo" | "direct" | "unsupported"
  videoId?: string
  url: string
  embedUrl?: string
  thumbnailUrl?: string
  title?: string
  duration?: number
}

// Helper to safely parse URL and check hostname
function getHostname(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase()
  } catch {
    return null
  }
}

// Strict hostname validation for video platforms
function isYouTubeUrl(hostname: string): boolean {
  return hostname === 'youtube.com' || 
    hostname === 'www.youtube.com' ||
    hostname === 'youtu.be' ||
    hostname === 'www.youtu.be'
}

function isVimeoUrl(hostname: string): boolean {
  return hostname === 'vimeo.com' || 
    hostname === 'www.vimeo.com' ||
    hostname === 'player.vimeo.com'
}

export function analyzeVideoUrl(url: string): VideoInfo {
  const cleanUrl = url.trim()
  const hostname = getHostname(cleanUrl)

  // YouTube detection using proper URL parsing
  if (hostname && isYouTubeUrl(hostname)) {
    const videoId = extractYouTubeId(cleanUrl)
    if (videoId) {
      return {
        type: "youtube",
        videoId,
        url: cleanUrl,
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
        thumbnailUrl: `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`,
      }
    }
  }

  // Vimeo detection using proper URL parsing
  if (hostname && isVimeoUrl(hostname)) {
    const videoId = extractVimeoId(cleanUrl)
    if (videoId) {
      return {
        type: "vimeo",
        videoId,
        url: cleanUrl,
        embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`,
      }
    }
  }

  // Direct video file detection
  if (isDirectVideoUrl(cleanUrl)) {
    return {
      type: "direct",
      url: cleanUrl,
    }
  }

  return {
    type: "unsupported",
    url: cleanUrl,
  }
}

function extractYouTubeId(url: string): string | null {
  // Use non-greedy matching and limit capture group length to prevent polynomial regex
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*?v=([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

function extractVimeoId(url: string): string | null {
  // Vimeo IDs are numeric, limit length to prevent issues
  const pattern = /vimeo\.com\/(?:video\/)?([0-9]{1,15})(?:\?|$|\/)/
  const match = url.match(pattern)
  return match ? match[1] : null
}

function isDirectVideoUrl(url: string): boolean {
  // Use URL pathname for extension check instead of includes()
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".wmv", ".flv"]
    return videoExtensions.some((ext) => pathname.endsWith(ext))
  } catch {
    // If URL parsing fails, fall back to simple extension check on the end
    const lowerUrl = url.toLowerCase()
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".wmv", ".flv"]
    return videoExtensions.some((ext) => lowerUrl.endsWith(ext))
  }
}

export function generateVideoEmbedHtml(
  videoInfo: VideoInfo,
  options: {
    width?: string
    height?: string
    autoplay?: boolean
    controls?: boolean
    className?: string
  } = {},
): string {
  const {
    width = "100%",
    height = "auto",
    autoplay = false,
    controls = true,
    className = "w-full rounded-xl shadow-lg",
  } = options

  switch (videoInfo.type) {
    case "youtube":
      const youtubeParams = new URLSearchParams({
        autoplay: autoplay ? "1" : "0",
        controls: controls ? "1" : "0",
        rel: "0",
        modestbranding: "1",
      })

      return `
        <div class="my-6 relative w-full aspect-video">
          <iframe 
            src="${videoInfo.embedUrl}?${youtubeParams.toString()}" 
            class="${className} absolute inset-0 w-full h-full"
            frameborder="0" 
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
      `

    case "vimeo":
      const vimeoParams = new URLSearchParams({
        autoplay: autoplay ? "1" : "0",
        controls: controls ? "1" : "0",
        title: "0",
        byline: "0",
        portrait: "0",
      })

      return `
        <div class="my-6 relative w-full aspect-video">
          <iframe 
            src="${videoInfo.embedUrl}?${vimeoParams.toString()}" 
            class="${className} absolute inset-0 w-full h-full"
            frameborder="0" 
            allowfullscreen
            allow="autoplay; fullscreen; picture-in-picture">
          </iframe>
        </div>
      `

    case "direct":
      return `
        <div class="my-6">
          <video 
            ${controls ? "controls" : ""} 
            ${autoplay ? "autoplay" : ""} 
            class="${className}"
            style="width: ${width}; height: ${height};">
            <source src="${videoInfo.url}" type="video/mp4">
            <p>Your browser does not support the video tag. <a href="${videoInfo.url}" target="_blank">Download the video</a></p>
          </video>
        </div>
      `

    default:
      return `
        <div class="my-6 p-4 border border-red-200 bg-red-50 rounded-lg">
          <p class="text-red-600">Unsupported video URL: ${videoInfo.url}</p>
        </div>
      `
  }
}

export async function getVideoMetadata(videoInfo: VideoInfo): Promise<Partial<VideoInfo>> {
  try {
    switch (videoInfo.type) {
      case "youtube":
        // In a real implementation, you'd use YouTube API
        return {
          title: "YouTube Video",
          thumbnailUrl: `https://img.youtube.com/vi/${videoInfo.videoId}/maxresdefault.jpg`,
        }

      case "vimeo":
        // In a real implementation, you'd use Vimeo API
        return {
          title: "Vimeo Video",
        }

      default:
        return {}
    }
  } catch (error) {
    console.error("Error fetching video metadata:", error)
    return {}
  }
}

export function validateVideoUrl(url: string): { isValid: boolean; error?: string } {
  if (!url || typeof url !== "string") {
    return { isValid: false, error: "URL is required" }
  }

  try {
    new URL(url)
  } catch {
    return { isValid: false, error: "Invalid URL format" }
  }

  const videoInfo = analyzeVideoUrl(url)
  if (videoInfo.type === "unsupported") {
    return {
      isValid: false,
      error: "Unsupported video platform. Please use YouTube, Vimeo, or direct video links.",
    }
  }

  return { isValid: true }
}

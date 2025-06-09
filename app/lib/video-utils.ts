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

export function analyzeVideoUrl(url: string): VideoInfo {
  const cleanUrl = url.trim()

  // YouTube detection
  if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) {
    const videoId = extractYouTubeId(cleanUrl)
    if (videoId) {
      return {
        type: "youtube",
        videoId,
        url: cleanUrl,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      }
    }
  }

  // Vimeo detection
  if (cleanUrl.includes("vimeo.com")) {
    const videoId = extractVimeoId(cleanUrl)
    if (videoId) {
      return {
        type: "vimeo",
        videoId,
        url: cleanUrl,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
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
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
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
  const pattern = /vimeo\.com\/(?:video\/)?(\d+)/
  const match = url.match(pattern)
  return match ? match[1] : null
}

function isDirectVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi", ".wmv", ".flv"]
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some((ext) => lowerUrl.includes(ext))
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

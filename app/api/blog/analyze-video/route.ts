import { type NextRequest, NextResponse } from "next/server"
import { analyzeVideoUrl, validateVideoUrl, getVideoMetadata } from "../../../lib/video-utils"
import type { VideoEmbedResponse } from "../../../types/blog-types"

export async function POST(request: NextRequest): Promise<NextResponse<VideoEmbedResponse>> {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ success: false, error: "Video URL is required" }, { status: 400 })
    }

    // Validate the URL
    const validation = validateVideoUrl(url)
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
    }

    // Analyze the video URL
    const videoInfo = analyzeVideoUrl(url)

    if (videoInfo.type === "unsupported") {
      return NextResponse.json({ success: false, error: "Unsupported video platform" }, { status: 400 })
    }

    // Get additional metadata if possible
    const metadata = await getVideoMetadata(videoInfo)

    const videoEmbed = {
      type: videoInfo.type,
      video_id: videoInfo.videoId,
      url: videoInfo.url,
      title: metadata.title,
      thumbnail: metadata.thumbnailUrl,
      duration: metadata.duration,
      embed_code: videoInfo.embedUrl || videoInfo.url,
    }

    return NextResponse.json({
      success: true,
      video: videoEmbed,
      message: `Successfully analyzed ${videoInfo.type} video`,
    })
  } catch (error) {
    console.error("Error analyzing video:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to analyze video: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { validateInstagramConfig, getInstagramConfigurationStatus } from "../../../lib/instagram-config"
import { calculateEngagementRate, extractHashtags } from "../../../lib/instagram-utils"

// Helper function to convert relative dates to YYYY-MM-DD format
function formatDateForInstagram(dateString: string): string {
  const today = new Date()

  switch (dateString) {
    case "today":
      return today.toISOString().split("T")[0]
    case "yesterday":
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday.toISOString().split("T")[0]
    case "7daysAgo":
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return sevenDaysAgo.toISOString().split("T")[0]
    case "30daysAgo":
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return thirtyDaysAgo.toISOString().split("T")[0]
    case "90daysAgo":
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      return ninetyDaysAgo.toISOString().split("T")[0]
    default:
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }
      // Default to today if format is unrecognized
      return today.toISOString().split("T")[0]
  }
}

async function fetchInstagramData(endpoint: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v23.0/${endpoint}`)

  // Add access token
  url.searchParams.append("access_token", accessToken)

  // Add additional parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  console.log(`[Instagram API] Fetching: ${url.toString().replace(accessToken, "HIDDEN_TOKEN")}`)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Instagram API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
  }

  return response.json()
}

export async function GET(request: NextRequest) {
  console.log("[Instagram API] =================================")
  console.log("[Instagram API] Request received:", request.url)
  console.log("[Instagram API] Method:", request.method)

  try {
    // Check configuration first
    console.log("[Instagram API] Checking configuration...")

    const configStatus = getInstagramConfigurationStatus()
    console.log("[Instagram API] Configuration status:", {
      configured: configStatus.configured,
      environmentVariables: configStatus.environmentVariables,
      accessToken: configStatus.accessToken ? "Present" : "Missing",
      facebookPageId: configStatus.facebookPageId ? "Present" : "Missing",
    })

    if (!validateInstagramConfig()) {
      console.error("[Instagram API] Configuration validation failed")

      // Get missing variables from environment check
      const missingVars = Object.entries(configStatus.environmentVariables)
        .filter(([_, exists]) => !exists)
        .map(([key, _]) => key)

      return NextResponse.json(
        {
          error: "Instagram API not configured properly.",
          missingVariables: missingVars,
          help: {
            message: "Required environment variables:",
            required: [
              "INSTAGRAM_ACCESS_TOKEN_TXMX - Your Instagram Business Account access token",
              "FACEBOOK_PAGE_ID_TXMX - Your Facebook Page ID connected to Instagram",
              "ADMIN_PASSWORD - Password for Instagram dashboard access",
            ],
          },
        },
        { status: 400 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const endpoint = searchParams.get("endpoint")
    const startDateParam = searchParams.get("startDate") || "30daysAgo"
    const endDateParam = searchParams.get("endDate") || "today"
    const adminKey = request.headers.get("x-admin-key")

    console.log("[Instagram API] Request parameters:", {
      endpoint,
      startDateParam,
      endDateParam,
      hasAdminKey: !!adminKey,
    })

    // Validate admin key
    const expectedAdminKey = process.env.ADMIN_PASSWORD
    if (!adminKey || adminKey !== expectedAdminKey) {
      console.error("[Instagram API] Invalid admin key")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Convert relative dates to proper format
    const startDate = formatDateForInstagram(startDateParam)
    const endDate = formatDateForInstagram(endDateParam)

    console.log("[Instagram API] Formatted dates:", {
      original: { startDateParam, endDateParam },
      formatted: { startDate, endDate },
    })

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN_TXMX!
    const pageId = process.env.FACEBOOK_PAGE_ID_TXMX!

    console.log("[Instagram API] Processing endpoint:", endpoint)

    switch (endpoint) {
      case "test-connection":
        console.log("[Instagram API] Testing connection...")
        try {
          const accountData = await fetchInstagramData(`${pageId}`, accessToken, {
            fields: "instagram_business_account",
          })

          if (accountData.instagram_business_account) {
            const instagramAccountId = accountData.instagram_business_account.id
            const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
              fields: "username,name,profile_picture_url,followers_count,follows_count,media_count",
            })

            return NextResponse.json({
              success: true,
              message: "Instagram API connection successful",
              account: {
                id: instagramAccountId,
                username: profileData.username,
                name: profileData.name,
                followers_count: profileData.followers_count,
                follows_count: profileData.follows_count,
                media_count: profileData.media_count,
              },
              timestamp: new Date().toISOString(),
            })
          } else {
            throw new Error("No Instagram Business Account found for this Facebook Page")
          }
        } catch (error) {
          console.error("[Instagram API] Connection test failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to connect to Instagram API",
              details: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString(),
            },
            { status: 500 },
          )
        }

      case "account-info":
        console.log("[Instagram API] Fetching account info...")
        try {
          const accountData = await fetchInstagramData(`${pageId}`, accessToken, {
            fields: "instagram_business_account",
          })

          const instagramAccountId = accountData.instagram_business_account.id
          const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
            fields: "username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          })

          return NextResponse.json({
            success: true,
            data: {
              id: instagramAccountId,
              username: profileData.username,
              name: profileData.name,
              biography: profileData.biography,
              profile_picture_url: profileData.profile_picture_url,
              website: profileData.website,
              followers_count: profileData.followers_count,
              follows_count: profileData.follows_count,
              media_count: profileData.media_count,
            },
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Account info fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch account info",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "insights":
      case "summary":
        console.log("[Instagram API] Fetching insights...")
        try {
          const accountData = await fetchInstagramData(`${pageId}`, accessToken, {
            fields: "instagram_business_account",
          })

          const instagramAccountId = accountData.instagram_business_account.id

          // Get account insights
          const insightsData = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
            metric: "impressions,reach,profile_views,website_clicks",
            period: "day",
            since: Math.floor(new Date(startDate).getTime() / 1000).toString(),
            until: Math.floor(new Date(endDate).getTime() / 1000).toString(),
          })

          // Get current follower count
          const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
            fields: "followers_count,follows_count,media_count",
          })

          // Process insights data
          const processedInsights = {
            impressions:
              insightsData.data
                .find((metric: any) => metric.name === "impressions")
                ?.values?.reduce((sum: number, day: any) => sum + day.value, 0) || 0,
            reach:
              insightsData.data
                .find((metric: any) => metric.name === "reach")
                ?.values?.reduce((sum: number, day: any) => sum + day.value, 0) || 0,
            profile_views:
              insightsData.data
                .find((metric: any) => metric.name === "profile_views")
                ?.values?.reduce((sum: number, day: any) => sum + day.value, 0) || 0,
            website_clicks:
              insightsData.data
                .find((metric: any) => metric.name === "website_clicks")
                ?.values?.reduce((sum: number, day: any) => sum + day.value, 0) || 0,
            followers_count: profileData.followers_count,
            follows_count: profileData.follows_count,
            media_count: profileData.media_count,
          }

          return NextResponse.json({
            success: true,
            data: processedInsights,
            period: { startDate, endDate },
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Insights fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch insights",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "media":
      case "posts":
        console.log("[Instagram API] Fetching media...")
        try {
          const accountData = await fetchInstagramData(`${pageId}`, accessToken, {
            fields: "instagram_business_account",
          })

          const instagramAccountId = accountData.instagram_business_account.id

          // Get media
          const mediaData = await fetchInstagramData(`${instagramAccountId}/media`, accessToken, {
            fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
            limit: "25",
          })

          if (!mediaData.data || mediaData.data.length === 0) {
            return NextResponse.json({
              success: true,
              data: [],
              timestamp: new Date().toISOString(),
            })
          }

          // Batch fetch insights for all media items
          const mediaIds = mediaData.data.map((media: any) => media.id)
          const batchedInsights = await fetchInstagramData(`${instagramAccountId}/media`, accessToken, {
            fields: `insights.metric(impressions,reach,engagement).period(lifetime){values}`,
            ids: `[${mediaIds.join(",")}]`,
          })

          const insightsMap = new Map()
          if (batchedInsights) {
            for (const mediaId in batchedInsights) {
              const insightsData = batchedInsights[mediaId]?.insights?.data
              if (insightsData) {
                const mediaInsights = insightsData.reduce((acc: any, insight: any) => {
                  acc[insight.name] = insight.values[0]?.value || 0
                  return acc
                }, {})
                insightsMap.set(mediaId, mediaInsights)
              }
            }
          }

          const mediaWithInsights = mediaData.data.map((media: any) => {
            const insights = insightsMap.get(media.id) || { impressions: 0, reach: 0, engagement: 0 }
            return {
              ...media,
              insights,
              engagement_rate: calculateEngagementRate(
                (media.like_count || 0) + (media.comments_count || 0),
                insights.reach || 1,
              ),
              hashtags: extractHashtags(media.caption || ""),
            }
          })

          return NextResponse.json({
            success: true,
            data: mediaWithInsights,
            pagination: mediaData.paging,
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Media fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch media",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      default:
        console.error("[Instagram API] Invalid endpoint:", endpoint)
        return NextResponse.json(
          {
            error: "Invalid endpoint parameter",
            endpoint: endpoint,
            availableEndpoints: ["test-connection", "account-info", "insights", "summary", "media", "posts"],
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[Instagram API] =================================")
    console.error("[Instagram API] CRITICAL ERROR:")
    console.error("[Instagram API] Error message:", error instanceof Error ? error.message : String(error))
    console.error("[Instagram API] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[Instagram API] =================================")

    let errorMessage = "Unknown error occurred"
    let statusCode = 500
    let errorType = "unknown"

    if (error instanceof Error) {
      errorMessage = error.message

      // Network connectivity errors
      if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("network")
      ) {
        statusCode = 503
        errorType = "network"
        errorMessage = `Network connectivity issue: ${error.message}`
      }
      // Instagram API specific errors
      else if (error.message.includes("Instagram API error")) {
        statusCode = 400
        errorType = "instagram_api"
      }
      // Permission errors
      else if (error.message.includes("permission") || error.message.includes("access")) {
        statusCode = 403
        errorType = "permission"
      }
      // Rate limit errors
      else if (error.message.includes("rate limit") || error.message.includes("quota")) {
        statusCode = 429
        errorType = "rate_limit"
      }
    }

    const errorResponse = {
      error: errorMessage,
      errorType,
      originalError: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorResponse, { status: statusCode })
  }
}

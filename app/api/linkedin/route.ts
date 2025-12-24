import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "../../lib/auth"
import {
  linkedinConfig,
  getLinkedInConfigurationStatus,
  getLinkedInHeaders,
  getOrganizationUrn,
  getLinkedInDateRange,
  LINKEDIN_API_BASE_URL,
  LINKEDIN_REST_API_BASE_URL,
} from "../../lib/linkedin-config"

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000
const FETCH_TIMEOUT = 30000

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLinkedInData(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  useRestApi: boolean = true, // Default to REST API (v2 is deprecated)
  retries = MAX_RETRIES
): Promise<any> {
  const baseUrl = useRestApi ? LINKEDIN_REST_API_BASE_URL : LINKEDIN_API_BASE_URL
  const url = new URL(`${baseUrl}/${endpoint}`)

  // Add parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  console.log(`[LinkedIn API] Fetching: ${url.toString()}`)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const response = await fetch(url.toString(), {
        headers: getLinkedInHeaders(accessToken),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Check for rate limiting
        if (response.status === 429) {
          if (attempt < retries) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1)
            console.log(
              `[LinkedIn API] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${retries})`
            )
            await sleep(delay)
            continue
          }
        }

        throw new Error(
          `LinkedIn API error: ${response.status} - ${
            errorData.message || errorData.error || response.statusText
          }`
        )
      }

      return response.json()
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("timeout") ||
          error.message.includes("ETIMEDOUT"))

      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND"))

      if ((isTimeout || isNetworkError) && attempt < retries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1)
        console.log(
          `[LinkedIn API] Network error, retrying in ${delay}ms (attempt ${attempt}/${retries})`
        )
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw new Error("Max retries exceeded")
}

export async function GET(request: NextRequest) {
  console.log("[LinkedIn API] =================================")
  console.log("[LinkedIn API] Request received:", request.url)

  try {
    // Check configuration
    const configStatus = getLinkedInConfigurationStatus()
    console.log("[LinkedIn API] Configuration status:", {
      configured: configStatus.configured,
      hasAccessToken: configStatus.hasAccessToken,
      hasOrganizationId: configStatus.hasOrganizationId,
    })

    if (!configStatus.configured) {
      console.error("[LinkedIn API] Configuration validation failed")

      return NextResponse.json(
        {
          error: "LinkedIn API not configured properly.",
          details: "Missing required environment variables",
          missingVariables: configStatus.missingRequired,
        },
        { status: 503 }
      )
    }

    // Auth check
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint") || "test-connection"
    const range = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d" | "365d") || "30d"

    const accessToken = linkedinConfig.accessToken
    const organizationId = linkedinConfig.organizationId
    const organizationUrn = getOrganizationUrn(organizationId)

    switch (endpoint) {
      case "test-connection": {
        // Test connection by fetching organization info
        try {
          const orgData = await fetchLinkedInData(
            `organizations/${organizationId}`,
            accessToken,
            { projection: "(id,name,vanityName,localizedName,logoV2,coverPhotoV2)" }
          )

          return NextResponse.json({
            success: true,
            message: "Successfully connected to LinkedIn API",
            organization: {
              id: orgData.id,
              name: orgData.localizedName || orgData.name,
              vanityName: orgData.vanityName,
            },
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : "Failed to connect",
          })
        }
      }

      case "organization-info": {
        // Get organization details including follower count
        const [orgData, followerData] = await Promise.all([
          fetchLinkedInData(`organizations/${organizationId}`, accessToken, {
            projection:
              "(id,name,vanityName,localizedName,localizedDescription,localizedWebsite,staffCountRange,industries,logoV2,coverPhotoV2)",
          }),
          fetchLinkedInData(
            `organizationalEntityFollowerStatistics`,
            accessToken,
            {
              q: "organizationalEntity",
              organizationalEntity: organizationUrn,
            }
          ).catch(() => null),
        ])

        const followersCount =
          followerData?.elements?.[0]?.followerCounts?.organicFollowerCount +
            followerData?.elements?.[0]?.followerCounts?.paidFollowerCount || 0

        return NextResponse.json({
          data: {
            id: orgData.id,
            name: orgData.localizedName || orgData.name,
            vanityName: orgData.vanityName,
            localizedName: orgData.localizedName,
            description: orgData.localizedDescription,
            websiteUrl: orgData.localizedWebsite,
            industry: orgData.industries?.[0],
            staffCountRange: orgData.staffCountRange,
            followersCount,
            pageUrl: `https://www.linkedin.com/company/${orgData.vanityName}`,
          },
        })
      }

      case "insights": {
        // Get organization page statistics
        const { startDate, endDate } = getLinkedInDateRange(range)

        // Fetch page statistics
        const pageStatsData = await fetchLinkedInData(
          `organizationPageStatistics`,
          accessToken,
          {
            q: "organization",
            organization: organizationUrn,
            "timeIntervals.timeGranularityType": "DAY",
            "timeIntervals.timeRange.start": startDate.toString(),
            "timeIntervals.timeRange.end": endDate.toString(),
          }
        ).catch(() => ({ elements: [] }))

        // Fetch follower statistics
        const followerStatsData = await fetchLinkedInData(
          `organizationalEntityFollowerStatistics`,
          accessToken,
          {
            q: "organizationalEntity",
            organizationalEntity: organizationUrn,
          }
        ).catch(() => ({ elements: [] }))

        // Fetch share (post) statistics
        const shareStatsData = await fetchLinkedInData(
          `organizationalEntityShareStatistics`,
          accessToken,
          {
            q: "organizationalEntity",
            organizationalEntity: organizationUrn,
            "timeIntervals.timeGranularityType": "DAY",
            "timeIntervals.timeRange.start": startDate.toString(),
            "timeIntervals.timeRange.end": endDate.toString(),
          }
        ).catch(() => ({ elements: [] }))

        // Aggregate statistics
        const pageStats = pageStatsData.elements || []
        const shareStats = shareStatsData.elements?.[0]?.totalShareStatistics || {}
        const followerStats = followerStatsData.elements?.[0] || {}

        // Calculate totals from page stats
        let totalPageViews = 0
        let totalUniquePageViews = 0
        let totalCareersPageViews = 0

        pageStats.forEach((stat: any) => {
          totalPageViews += stat.totalPageStatistics?.views?.allPageViews?.pageViews || 0
          totalUniquePageViews +=
            stat.totalPageStatistics?.views?.allPageViews?.uniquePageViews || 0
          totalCareersPageViews +=
            stat.totalPageStatistics?.views?.careersPageViews?.pageViews || 0
        })

        const organicFollowers = followerStats.followerCounts?.organicFollowerCount || 0
        const paidFollowers = followerStats.followerCounts?.paidFollowerCount || 0

        return NextResponse.json({
          data: {
            organizationId,
            period: "day",
            dateRange: {
              startDate: new Date(startDate).toISOString(),
              endDate: new Date(endDate).toISOString(),
            },
            // Page Statistics
            pageViews: totalPageViews,
            uniquePageViews: totalUniquePageViews,
            allPageViews: totalPageViews,
            careersPageViews: totalCareersPageViews,

            // Follower Statistics
            totalFollowers: organicFollowers + paidFollowers,
            organicFollowers,
            paidFollowers,
            followerGains: followerStats.followerGains?.organicFollowerGain || 0,
            followerLosses: 0, // LinkedIn API doesn't provide this directly
            netFollowerChange: followerStats.followerGains?.organicFollowerGain || 0,

            // Engagement Statistics (from shares)
            totalEngagements: shareStats.engagement || 0,
            reactions: shareStats.likeCount || 0,
            comments: shareStats.commentCount || 0,
            shares: shareStats.shareCount || 0,
            clicks: shareStats.clickCount || 0,
            impressions: shareStats.impressionCount || 0,

            _source: "linkedin_api",
          },
        })
      }

      case "posts": {
        // Get organization posts (formerly /shares, now /posts in versioned API)
        const postsData = await fetchLinkedInData(
          `posts`,
          accessToken,
          {
            q: "author",
            author: organizationUrn,
            count: "20",
            sortBy: "LAST_MODIFIED",
          }
        ).catch(() => ({ elements: [] }))

        // Get share statistics for each post
        const posts = postsData.elements || []
        const postsWithInsights = await Promise.all(
          posts.map(async (post: any) => {
            const shareUrn = post.activity || `urn:li:share:${post.id}`

            // Try to get individual share statistics
            const shareStats = await fetchLinkedInData(
              `organizationalEntityShareStatistics`,
              accessToken,
              {
                q: "organizationalEntity",
                organizationalEntity: organizationUrn,
                shares: shareUrn,
              }
            ).catch(() => null)

            const stats = shareStats?.elements?.[0]?.totalShareStatistics || {}

            return {
              id: post.id,
              author: post.owner,
              commentary: post.text?.text || post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
              createdAt: post.created?.time
                ? new Date(post.created.time).toISOString()
                : new Date().toISOString(),
              lastModifiedAt: post.lastModified?.time
                ? new Date(post.lastModified.time).toISOString()
                : new Date().toISOString(),
              visibility: post.visibility?.["com.linkedin.ugc.MemberNetworkVisibility"] || "PUBLIC",
              lifecycleState: "PUBLISHED",
              permalink: `https://www.linkedin.com/feed/update/${shareUrn}`,
              insights: {
                postId: post.id,
                impressions: stats.impressionCount || 0,
                uniqueImpressions: stats.uniqueImpressionsCount || 0,
                clicks: stats.clickCount || 0,
                likes: stats.likeCount || 0,
                comments: stats.commentCount || 0,
                shares: stats.shareCount || 0,
                engagement: stats.engagement || 0,
                engagementRate:
                  stats.impressionCount > 0
                    ? ((stats.likeCount + stats.commentCount + stats.shareCount) /
                        stats.impressionCount) *
                      100
                    : 0,
              },
            }
          })
        )

        return NextResponse.json({
          data: postsWithInsights,
          paging: {
            start: 0,
            count: postsWithInsights.length,
            total: postsData.paging?.total || postsWithInsights.length,
          },
        })
      }

      case "follower-demographics": {
        // Get follower demographics
        const demographicsData = await fetchLinkedInData(
          `organizationalEntityFollowerStatistics`,
          accessToken,
          {
            q: "organizationalEntity",
            organizationalEntity: organizationUrn,
          }
        ).catch(() => ({ elements: [] }))

        const stats = demographicsData.elements?.[0] || {}

        return NextResponse.json({
          data: {
            organizationId,
            byFunction: stats.followerCountsByFunction || [],
            bySeniority: stats.followerCountsBySeniority || [],
            byIndustry: stats.followerCountsByIndustry || [],
            byLocation: stats.followerCountsByGeoCountry || [],
            byCompanySize: stats.followerCountsByStaffCountRange || [],
          },
        })
      }

      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[LinkedIn API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch LinkedIn data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

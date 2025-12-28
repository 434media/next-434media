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
            {} // No projection - not supported in versioned REST API
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
        const [orgData, followerData, networkSize] = await Promise.all([
          fetchLinkedInData(`organizations/${organizationId}`, accessToken, {}),
          fetchLinkedInData(
            `organizationalEntityFollowerStatistics`,
            accessToken,
            {
              q: "organizationalEntity",
              organizationalEntity: organizationUrn,
            }
          ).catch(() => null),
          // Use networkSizes endpoint for more reliable follower count
          fetchLinkedInData(
            `networkSizes/${organizationUrn}`,
            accessToken,
            {
              edgeType: "COMPANY_FOLLOWED_BY_MEMBER",
            }
          ).catch(() => null),
        ])

        // Log raw organization data for debugging
        console.log("[LinkedIn API] Org data keys:", Object.keys(orgData || {}))
        console.log("[LinkedIn API] Has logoV2:", !!orgData.logoV2)
        console.log("[LinkedIn API] Description field:", orgData.localizedDescription || orgData.description || "(none)")

        // Prefer networkSizes data, fallback to follower statistics
        let followersCount = networkSize?.firstDegreeSize || 0
        if (!followersCount) {
          followersCount =
            (followerData?.elements?.[0]?.followerCounts?.organicFollowerCount || 0) +
              (followerData?.elements?.[0]?.followerCounts?.paidFollowerCount || 0)
        }

        // Extract logo URL from logoV2 object - LinkedIn returns URNs or complex nested structure
        // logoV2.original/cropped can be: URN string OR object with vectorImage
        let logoUrl: string | undefined
        try {
          console.log("[LinkedIn API] logoV2 structure:", JSON.stringify(orgData.logoV2, null, 2)?.substring(0, 500))
          
          // Check if logoV2 contains direct vectorImage data
          if (orgData.logoV2?.original && typeof orgData.logoV2.original === 'object') {
            // New format: logoV2.original is an object with vectorImage
            const vectorImage = orgData.logoV2.original.vectorImage
            if (vectorImage?.rootUrl && vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment) {
              logoUrl = `${vectorImage.rootUrl}${vectorImage.artifacts[0].fileIdentifyingUrlPathSegment}`
            }
          } else if (orgData.logoV2?.cropped && typeof orgData.logoV2.cropped === 'object') {
            const vectorImage = orgData.logoV2.cropped.vectorImage
            if (vectorImage?.rootUrl && vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment) {
              logoUrl = `${vectorImage.rootUrl}${vectorImage.artifacts[0].fileIdentifyingUrlPathSegment}`
            }
          }
          
          // If logoV2 contains URN strings, we can't resolve them without additional API calls
          // Log for debugging
          if (!logoUrl && orgData.logoV2) {
            console.log("[LinkedIn API] logoV2 appears to be URN-based, cannot resolve to URL directly")
          }
        } catch (e) {
          console.log("[LinkedIn API] Logo parsing error:", e)
        }

        return NextResponse.json({
          data: {
            id: orgData.id,
            name: orgData.localizedName || orgData.name,
            vanityName: orgData.vanityName,
            localizedName: orgData.localizedName,
            description: orgData.localizedDescription || orgData.description,
            websiteUrl: orgData.localizedWebsite || orgData.website,
            industry: orgData.localizedIndustry || orgData.industries?.[0],
            staffCountRange: orgData.staffCountRange,
            followersCount,
            logoUrl,
            pageUrl: `https://www.linkedin.com/company/${orgData.vanityName}`,
          },
        })
      }

      case "insights": {
        // Get organization page statistics
        const { startDate, endDate } = getLinkedInDateRange(range)

        // Try lifetime stats first (no time range) - more reliable and doesn't require special formatting
        // Then fall back to time-bound if needed
        let pageStatsData: any = { elements: [] }
        
        // First try lifetime stats (simpler, more reliable)
        try {
          pageStatsData = await fetchLinkedInData(
            `organizationPageStatistics`,
            accessToken,
            {
              q: "organization",
              organization: organizationUrn,
            }
          )
          console.log("[LinkedIn API] Lifetime page stats fetched successfully")
        } catch (e: any) {
          console.log("[LinkedIn API] Lifetime page stats failed:", e.message)
          // Try time-bound with Restli 2.0 format
          try {
            const timeIntervalsParam = `(timeRange:(start:${startDate},end:${endDate}),timeGranularityType:DAY)`
            pageStatsData = await fetchLinkedInData(
              `organizationPageStatistics`,
              accessToken,
              {
                q: "organization",
                organization: organizationUrn,
                timeIntervals: timeIntervalsParam,
              }
            )
            console.log("[LinkedIn API] Time-bound page stats fetched successfully")
          } catch (e2: any) {
            console.log("[LinkedIn API] Time-bound page stats also failed:", e2.message)
          }
        }

        // Fetch follower statistics (less API-intensive, just one call)
        const followerStatsData = await fetchLinkedInData(
          `organizationalEntityFollowerStatistics`,
          accessToken,
          {
            q: "organizationalEntity",
            organizationalEntity: organizationUrn,
          }
        ).catch((e) => {
          console.log("[LinkedIn API] Follower stats fetch failed:", e.message)
          return { elements: [] }
        })

        // Fetch share (post) statistics - try lifetime first
        let shareStatsData: any = { elements: [] }
        try {
          shareStatsData = await fetchLinkedInData(
            `organizationalEntityShareStatistics`,
            accessToken,
            {
              q: "organizationalEntity",
              organizationalEntity: organizationUrn,
            }
          )
          console.log("[LinkedIn API] Lifetime share stats fetched successfully")
        } catch (e: any) {
          console.log("[LinkedIn API] Share stats fetch failed:", e.message)
        }

        // Log raw responses for debugging
        console.log("[LinkedIn API] Page stats elements count:", pageStatsData.elements?.length || 0)
        if (pageStatsData.elements?.length > 0) {
          console.log("[LinkedIn API] Page stats first element keys:", Object.keys(pageStatsData.elements[0]))
          console.log("[LinkedIn API] Total page stats:", JSON.stringify(pageStatsData.elements[0]?.totalPageStatistics?.views || {}).substring(0, 500))
        }
        console.log("[LinkedIn API] Follower stats raw:", JSON.stringify(followerStatsData.elements?.[0] || {}))
        console.log("[LinkedIn API] Share stats raw:", JSON.stringify(shareStatsData.elements?.[0]?.totalShareStatistics || {}))

        // Also fetch network size for more reliable follower count
        let networkSize: any = null
        try {
          networkSize = await fetchLinkedInData(
            `networkSizes/${organizationUrn}`,
            accessToken,
            {
              edgeType: "COMPANY_FOLLOWED_BY_MEMBER",
            }
          )
          console.log("[LinkedIn API] Network size:", networkSize?.firstDegreeSize)
        } catch (e: any) {
          console.log("[LinkedIn API] Network size fetch failed:", e.message)
        }

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
        
        // Prefer networkSizes data for total followers
        const totalFollowers = networkSize?.firstDegreeSize || (organicFollowers + paidFollowers)

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
            totalFollowers,
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

        const posts = postsData.elements || []
        console.log("[LinkedIn API] Posts fetched:", posts.length)
        
        // Process posts - only fetch stats for first 3 posts SEQUENTIALLY to avoid rate limiting
        const postsWithInsights = []
        for (let index = 0; index < posts.length; index++) {
          const post = posts[index]
          
          // The post ID may already be a URN like "urn:li:share:123" or "urn:li:ugcPost:123"
          let shareUrn = post.id
          
          // If id doesn't start with urn:, construct it based on the content type
          if (!post.id.startsWith('urn:li:')) {
            shareUrn = post.activity || `urn:li:share:${post.id}`
          }
          
          // Only fetch stats for first 3 posts SEQUENTIALLY to avoid rate limiting
          let stats: Record<string, number> = {}
          if (index < 3) {
            try {
              console.log(`[LinkedIn API] Fetching stats for post ${index + 1}/3`)
              const shareStats = await fetchLinkedInData(
                `organizationalEntityShareStatistics`,
                accessToken,
                {
                  q: "organizationalEntity",
                  organizationalEntity: organizationUrn,
                  shares: shareUrn,
                }
              )
              stats = shareStats?.elements?.[0]?.totalShareStatistics || {}
              console.log(`[LinkedIn API] Post ${index + 1} stats:`, stats)
            } catch (e: any) {
              console.log(`[LinkedIn API] Post ${index + 1} stats failed:`, e.message)
              // If rate limited, skip remaining stats
              if (e.message.includes('429') || e.message.includes('throttle')) {
                console.log("[LinkedIn API] Rate limited, skipping remaining post stats")
              }
            }
          }

          postsWithInsights.push({
            id: post.id,
            author: post.owner || post.author,
            commentary: post.commentary || post.text?.text || post.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "",
            createdAt: post.createdAt || (post.created?.time
              ? new Date(post.created.time).toISOString()
              : new Date().toISOString()),
            lastModifiedAt: post.lastModifiedAt || (post.lastModified?.time
              ? new Date(post.lastModified.time).toISOString()
              : new Date().toISOString()),
            visibility: post.visibility || "PUBLIC",
            lifecycleState: post.lifecycleState || "PUBLISHED",
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
                  ? (((stats.likeCount || 0) + (stats.commentCount || 0) + (stats.shareCount || 0)) /
                      stats.impressionCount) *
                    100
                  : 0,
            },
          })
        }

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

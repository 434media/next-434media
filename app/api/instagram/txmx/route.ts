import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "../../../lib/auth"
import { getInstagramConfigurationStatus } from "../../../lib/instagram-config"
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

// Retry configuration for transient failures
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const FETCH_TIMEOUT = 30000 // 30 seconds

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchInstagramData(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  retries = MAX_RETRIES
): Promise<any> {
  const url = new URL(`https://graph.facebook.com/v23.0/${endpoint}`)

  // Add access token
  url.searchParams.append("access_token", accessToken)

  // Add additional parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  console.log(`[Instagram API] Fetching: ${url.toString().replace(accessToken, "HIDDEN_TOKEN")}`)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Check for rate limiting
        if (response.status === 429) {
          if (attempt < retries) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1)
            console.log(`[Instagram API] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${retries})`)
            await sleep(delay)
            continue
          }
        }
        
        throw new Error(`Instagram API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      return response.json()
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("timeout") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("UND_ERR_CONNECT_TIMEOUT"))
      
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch failed") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND"))

      if ((isTimeout || isNetworkError) && attempt < retries) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1)
        console.log(`[Instagram API] Network error, retrying in ${delay}ms (attempt ${attempt}/${retries}): ${error instanceof Error ? error.message : error}`)
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw new Error("Max retries exceeded")
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

    if (!configStatus.configured) {
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
  const debug = (searchParams.get("debug") || "").toLowerCase() === "true"

    console.log("[Instagram API] Request parameters:", {
      endpoint,
      startDateParam,
      endDateParam,
    })

    // Check for valid session
    const session = await getSession()
    if (!session) {
      console.error("[Instagram API] No valid session")
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
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX

    console.log("[Instagram API] Processing endpoint:", endpoint)

    // Helper to get instagram business account id, preferring env override
    const resolveInstagramBusinessAccountId = async (): Promise<string> => {
      // Prefer env override only if it looks like a real IG User ID (commonly starts with 1784...)
      const looksIGUserId = (val?: string) => !!val && /^1784\d+$/.test(val)
      const isNumeric = (val?: string) => !!val && /^\d+$/.test(val)
      if (looksIGUserId(businessAccountId)) {
        return businessAccountId as string
      }

      if (businessAccountId) {
        const note = isNumeric(businessAccountId)
          ? "numeric but does not resemble an Instagram User ID"
          : "invalid or placeholder"
        console.warn(
          `[Instagram API] Provided INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX is ${note}. Falling back to resolving via FACEBOOK_PAGE_ID_TXMX.`,
        )
      }

      const accountData = await fetchInstagramData(`${pageId}`, accessToken, {
        fields: "instagram_business_account",
      })
      if (!accountData.instagram_business_account?.id) {
        throw new Error("No Instagram Business Account found for this Facebook Page")
      }
      const resolvedId = accountData.instagram_business_account.id as string
      if (!looksIGUserId(resolvedId)) {
        throw new Error(
          `Resolved Instagram Business Account ID does not look like an IG User ID: ${resolvedId}. Ensure your app has required permissions and the Page is properly connected to an IG Business account.`,
        )
      }
      return resolvedId
    }

    switch (endpoint) {
  case "test-connection":
        console.log("[Instagram API] Testing connection...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()
          if (instagramAccountId) {
            const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
      fields: "username,followers_count,follows_count,media_count,profile_picture_url,name",
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
                profile_picture_url: profileData.profile_picture_url,
              },
              timestamp: new Date().toISOString(),
            })
          } else {
            throw new Error("No Instagram Business Account found for this Facebook Page")
          }
        } catch (error) {
          console.error("[Instagram API] Connection test failed:", error)
          const message = error instanceof Error ? error.message : String(error)
          const missingPermissions: string[] = []
          if (message.includes("pages_read_engagement")) missingPermissions.push("pages_read_engagement")
          if (message.toLowerCase().includes("page public content access")) missingPermissions.push("pages_access")
          if (message.toLowerCase().includes("page public metadata access")) missingPermissions.push("page_public_metadata_access")

          const responseBody: any = {
            success: false,
            error: "Failed to connect to Instagram API",
            details: message,
            missingPermissions,
            suggestions: missingPermissions.length
              ? [
                  "Ensure your access token is a Page access token or system user token with the required permissions.",
                  "Grant pages_read_engagement and instagram_basic in App Review for live apps.",
                  "Alternatively, set a valid INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX to avoid the Page lookup.",
                ]
              : undefined,
            timestamp: new Date().toISOString(),
          }

          const status = missingPermissions.length ? 403 : 500
          return NextResponse.json(responseBody, { status })
        }

  case "account-info":
        console.log("[Instagram API] Fetching account info...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()
          const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
    fields: "username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url",
          })

          return NextResponse.json({
            success: true,
            data: {
              id: instagramAccountId,
              username: profileData.username,
              name: profileData.name,
              biography: profileData.biography,
              website: profileData.website,
              followers_count: profileData.followers_count,
              follows_count: profileData.follows_count,
              media_count: profileData.media_count,
              profile_picture_url: profileData.profile_picture_url,
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
          const instagramAccountId = await resolveInstagramBusinessAccountId()

          // IMPORTANT: Different metrics support different metric_type modes.
          // Request time-series metrics separately from total_value metrics to avoid empty results.
          const sinceTs = Math.floor(new Date(startDate).getTime() / 1000).toString()
          const untilTs = Math.floor(new Date(endDate).getTime() / 1000).toString()

          // Helper to build params and omit since/until for lifetime period
          const paramsWithWindow = (base: Record<string, string>, period: string) => {
            const p: Record<string, string> = { ...base, period }
            if (period !== "lifetime") {
              p.since = sinceTs
              p.until = untilTs
            }
            return p
          }

          // Compute window length and chunk into <=30-day segments when needed
          const diffDays = (a: string, b: string) => Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
          const totalDays = diffDays(startDate, endDate)
          const buildChunks = (from: string, to: string, maxDays = 30): Array<{ since: string; until: string }> => {
            const chunks: Array<{ since: string; until: string }> = []
            let cur = new Date(from)
            const endD = new Date(to)
            while (cur <= endD) {
              const chunkStart = new Date(cur)
              const chunkEnd = new Date(chunkStart)
              chunkEnd.setDate(chunkEnd.getDate() + (maxDays - 1))
              if (chunkEnd > endD) chunkEnd.setTime(endD.getTime())
              chunks.push({
                since: chunkStart.toISOString().split('T')[0],
                until: chunkEnd.toISOString().split('T')[0],
              })
              // next day after chunkEnd
              cur = new Date(chunkEnd)
              cur.setDate(cur.getDate() + 1)
            }
            return chunks
          }

          // Time-series metrics: reach (day series) with follower/non-follower breakdown aggregation if present
          let insightsTimeSeries: any = null
          let reachSum = 0
          let reachFollowersSum = 0
          let reachNonFollowersSum = 0
          if (totalDays > 30) {
            // Chunked fetch for reach
            const chunks = buildChunks(startDate, endDate, 30)
            for (const c of chunks) {
              const r = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
                metric: "reach",
                period: "day",
                since: Math.floor(new Date(c.since).getTime() / 1000).toString(),
                until: Math.floor(new Date(c.until).getTime() / 1000).toString(),
              })
              if (debug) {
                console.log("[DEBUG][insights] reach chunk", c, JSON.stringify(r?.data || [], null, 2))
              }
              const m = r?.data?.find((d: any) => d.name === 'reach')
              if (m?.values) {
                for (const e of m.values) {
                  const v = e?.value
                  if (typeof v === 'number') {
                    reachSum += v
                  } else if (v && typeof v === 'object') {
                    // Prefer explicit breakdown keys when present
                    const followersVal = v.followers ?? v.follower ?? v.followers_count ?? 0
                    const nonFollowersVal = v.non_followers ?? v.non_follower ?? v.non_followers_count ?? 0
                    const totalVal = typeof v.total_value === 'number' ? v.total_value : (typeof v.value === 'number' ? v.value : (followersVal + nonFollowersVal))
                    reachSum += typeof totalVal === 'number' ? totalVal : 0
                    reachFollowersSum += typeof followersVal === 'number' ? followersVal : 0
                    reachNonFollowersSum += typeof nonFollowersVal === 'number' ? nonFollowersVal : 0
                  }
                }
              }
            }
          } else {
            insightsTimeSeries = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "reach",
              period: "day",
              since: sinceTs,
              until: untilTs,
            })
            if (debug) {
              console.log("[DEBUG][insights] reach timeseries", JSON.stringify(insightsTimeSeries?.data || [], null, 2))
            }
          }

          // Total value metrics (numeric): views, profile_views, website_clicks, total_interactions
      const fetchTotalsNumeric = async (period: "day" | "days_28" | "week" | "month" | "lifetime") =>
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, paramsWithWindow({
        metric: "views,profile_views,website_clicks,total_interactions",
              metric_type: "total_value",
            }, period))

          let insightsTotalsNumeric: any = null
          let aggregatedTotalsNumeric: { [k: string]: number } | null = null
          // Track follower breakdown for totals metrics where available (views/profile_views)
          let aggregatedTotalsBreakdown: {
            [k: string]: { followers: number; non_followers: number }
          } | null = null
          if (totalDays > 30) {
            // Chunk day requests into 30d windows and aggregate sums
            aggregatedTotalsNumeric = { views: 0, profile_views: 0, website_clicks: 0, total_interactions: 0 }
            aggregatedTotalsBreakdown = {
              views: { followers: 0, non_followers: 0 },
              profile_views: { followers: 0, non_followers: 0 },
              total_interactions: { followers: 0, non_followers: 0 },
            }
            const chunks = buildChunks(startDate, endDate, 30)
            for (const c of chunks) {
              const res = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
                metric: "views,profile_views,website_clicks,total_interactions",
                metric_type: "total_value",
                period: "day",
                since: Math.floor(new Date(c.since).getTime() / 1000).toString(),
                until: Math.floor(new Date(c.until).getTime() / 1000).toString(),
              })
              if (debug) {
                console.log("[DEBUG][insights] totals chunk", c, JSON.stringify(res?.data || [], null, 2))
              }
              for (const name of ["views", "profile_views", "website_clicks", "total_interactions"]) {
                const m = res?.data?.find((d: any) => d.name === name)
                if (m?.values) {
                  for (const e of m.values) {
                    const v = e?.value
                    if (typeof v === 'number') {
                      aggregatedTotalsNumeric[name] += v
                    } else if (v && typeof v === 'object') {
                      const followersVal = v.followers ?? v.follower ?? v.followers_count ?? 0
                      const nonFollowersVal = v.non_followers ?? v.non_follower ?? v.non_followers_count ?? 0
                      const totalVal = typeof v.total_value === 'number' ? v.total_value : (typeof v.value === 'number' ? v.value : (followersVal + nonFollowersVal))
                      aggregatedTotalsNumeric[name] += typeof totalVal === 'number' ? totalVal : 0
                      if (name === 'views' || name === 'profile_views' || name === 'total_interactions') {
                        aggregatedTotalsBreakdown![name].followers += typeof followersVal === 'number' ? followersVal : 0
                        aggregatedTotalsBreakdown![name].non_followers += typeof nonFollowersVal === 'number' ? nonFollowersVal : 0
                      }
                    }
                  }
                }
              }
            }
          } else {
            try {
              insightsTotalsNumeric = await fetchTotalsNumeric("day")
              if (debug) {
                console.log("[DEBUG][insights] totals day raw response:", JSON.stringify(insightsTotalsNumeric, null, 2))
                // Log the structure of each metric to help debug
                if (insightsTotalsNumeric?.data) {
                  for (const m of insightsTotalsNumeric.data) {
                    console.log(`[DEBUG][insights] metric "${m.name}" structure:`, {
                      has_total_value: m.total_value !== undefined,
                      total_value_type: typeof m.total_value,
                      total_value_value: m.total_value?.value,
                      has_values_array: Array.isArray(m.values),
                      values_length: m.values?.length,
                    })
                  }
                }
              }
            } catch (err) {
              console.error("[Instagram API] Failed to fetch totals metrics:", err)
              // Initialize as empty so fallback logic triggers
              insightsTotalsNumeric = { data: [] }
            }
          }

          // Total value metrics (object payload): follows_and_unfollows
          // breakdown=follow_type returns FOLLOWER/NON_FOLLOWER which are both new follows
          // (FOLLOWER = users who refollowed, NON_FOLLOWER = new followers)
          const fetchTotalsFollows = async (period: "day" | "days_28") =>
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, paramsWithWindow({
              metric: "follows_and_unfollows",
              metric_type: "total_value",
              breakdown: "follow_type",
            }, period))
          let insightsTotalsFollows: any = null
          let aggregatedFollows = { follows: 0, unfollows: 0 }
          if (totalDays > 30) {
            const chunks = buildChunks(startDate, endDate, 30)
            for (const c of chunks) {
              const res = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
                metric: "follows_and_unfollows",
                metric_type: "total_value",
                period: "day",
                since: Math.floor(new Date(c.since).getTime() / 1000).toString(),
                until: Math.floor(new Date(c.until).getTime() / 1000).toString(),
              })
              const m = res?.data?.find((d: any) => d.name === 'follows_and_unfollows')
              if (m) {
                // Handle total_value structure (metric_type=total_value response)
                if (m.total_value !== undefined) {
                  const tv = m.total_value
                  // Direct follows/unfollows on total_value object
                  if (typeof tv.follows === 'number') aggregatedFollows.follows += tv.follows
                  if (typeof tv.unfollows === 'number') aggregatedFollows.unfollows += tv.unfollows
                  // Check total_value.value object
                  if (tv.value && typeof tv.value === 'object') {
                    if (typeof tv.value.follows === 'number') aggregatedFollows.follows += tv.value.follows
                    if (typeof tv.value.unfollows === 'number') aggregatedFollows.unfollows += tv.value.unfollows
                  }
                  // Check breakdowns - handle dimension_values format ["FOLLOWS"] / ["UNFOLLOWS"]
                  if (tv.breakdowns) {
                    for (const bd of tv.breakdowns) {
                      for (const r of (bd.results || [])) {
                        const dims = r.dimension_values || []
                        const val = typeof r.value === 'number' ? r.value : 0
                        // Check dimension_values - FOLLOWER/NON_FOLLOWER both count as new follows
                        for (const d of dims) {
                          const dLower = String(d).toLowerCase().replace(/-/g, '_')
                          // FOLLOWER and NON_FOLLOWER are both new followers
                          if (dLower === 'follower' || dLower === 'non_follower' || dLower === 'nonfollower' || 
                              dLower === 'follows' || dLower === 'follow') {
                            aggregatedFollows.follows += val
                          }
                          if (dLower === 'unfollows' || dLower === 'unfollow') aggregatedFollows.unfollows += val
                        }
                        // Also check if the result.value is an object with follows/unfollows
                        if (r.value && typeof r.value === 'object') {
                          if (typeof r.value.follows === 'number') aggregatedFollows.follows += r.value.follows
                          if (typeof r.value.unfollows === 'number') aggregatedFollows.unfollows += r.value.unfollows
                        }
                      }
                    }
                  }
                }
                // Fallback to values array structure
                if (m.values && Array.isArray(m.values)) {
                  for (const e of m.values) {
                    const v = e?.value
                    if (v && typeof v === 'object') {
                      aggregatedFollows.follows += typeof v.follows === 'number' ? v.follows : 0
                      aggregatedFollows.unfollows += typeof v.unfollows === 'number' ? v.unfollows : 0
                    }
                    // Also check for breakdowns within each value entry
                    if (e?.breakdowns) {
                      for (const bd of e.breakdowns) {
                        for (const r of (bd.results || [])) {
                          const dims = r.dimension_values || []
                          const val = typeof r.value === 'number' ? r.value : 0
                          for (const d of dims) {
                            const dLower = String(d).toLowerCase().replace(/-/g, '_')
                            // FOLLOWER and NON_FOLLOWER are both new followers
                            if (dLower === 'follower' || dLower === 'non_follower' || dLower === 'nonfollower' || 
                                dLower === 'follows' || dLower === 'follow') {
                              aggregatedFollows.follows += val
                            }
                            if (dLower === 'unfollows' || dLower === 'unfollow') aggregatedFollows.unfollows += val
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          } else {
            try {
              insightsTotalsFollows = await fetchTotalsFollows("day")
              // Always log the follows response to diagnose the issue
              console.log("[Instagram API] follows_and_unfollows response:", JSON.stringify(insightsTotalsFollows, null, 2))
              if (debug) {
                console.log("[DEBUG][insights] follows day raw response:", JSON.stringify(insightsTotalsFollows, null, 2))
                // Log the structure of the follows metric
                if (insightsTotalsFollows?.data) {
                  for (const m of insightsTotalsFollows.data) {
                    console.log(`[DEBUG][insights] follows metric "${m.name}" structure:`, {
                      has_total_value: m.total_value !== undefined,
                      total_value_type: typeof m.total_value,
                      total_value_content: m.total_value,
                      has_values_array: Array.isArray(m.values),
                      values_length: m.values?.length,
                      first_value: m.values?.[0],
                    })
                  }
                }
              }
            } catch (err) {
              console.error("[Instagram API] Failed to fetch follows metrics:", err)
              insightsTotalsFollows = { data: [] }
            }
          }

          // Get current follower count
          const profileData = await fetchInstagramData(instagramAccountId, accessToken, {
            fields: "followers_count,follows_count,media_count",
          })

          // Also fetch follower_count time series to compute net growth if needed
          let followerCountSeries: any | null = null
          try {
            followerCountSeries = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "follower_count",
              period: "day",
              since: sinceTs,
              until: untilTs,
            })
          } catch {}

          // Process insights data
          // Helper to safely sum values list (values can be numbers or objects)
          const sumValuesSeries = (metricName: string): number => {
            if (metricName === 'reach' && totalDays > 30) return reachSum
            if (!insightsTimeSeries?.data) return 0
            const m = insightsTimeSeries.data.find((metric: any) => metric.name === metricName)
            if (!m || !Array.isArray(m.values)) return 0
            return m.values.reduce((sum: number, entry: any) => {
              const val = entry?.value
              if (typeof val === 'number') return sum + val
              if (val && typeof val === 'object') {
                const followersVal = val.followers ?? val.follower ?? val.followers_count ?? 0
                const nonFollowersVal = val.non_followers ?? val.non_follower ?? val.non_followers_count ?? 0
                const n = typeof val.total_value === 'number' ? val.total_value : (typeof val.value === 'number' ? val.value : (followersVal + nonFollowersVal))
                // Also accumulate breakdown for reach when not chunked
                if (metricName === 'reach') {
                  reachFollowersSum += typeof followersVal === 'number' ? followersVal : 0
                  reachNonFollowersSum += typeof nonFollowersVal === 'number' ? nonFollowersVal : 0
                }
                return sum + (typeof n === 'number' ? n : 0)
              }
              return sum
            }, 0)
          }

          // Helper for totals response - handles both total_value structure AND values array
          const sumValuesTotals = (metricName: string): number => {
            if (aggregatedTotalsNumeric) return aggregatedTotalsNumeric[metricName] || 0
            if (!insightsTotalsNumeric?.data) return 0
            const m = insightsTotalsNumeric.data.find((metric: any) => metric.name === metricName)
            if (!m) return 0
            
            // Check for total_value structure first (metric_type=total_value response)
            if (m.total_value !== undefined) {
              if (typeof m.total_value === 'number') return m.total_value
              if (m.total_value && typeof m.total_value === 'object') {
                if (typeof m.total_value.value === 'number') return m.total_value.value
                // Handle breakdown structure
                const breakdowns = m.total_value.breakdowns || []
                let sum = 0
                for (const bd of breakdowns) {
                  for (const r of (bd.results || [])) {
                    if (typeof r.value === 'number') sum += r.value
                  }
                }
                if (sum > 0) return sum
              }
            }
            
            // Fallback to values array (time-series response)
            if (!Array.isArray(m.values)) return 0
            return m.values.reduce((sum: number, entry: any) => {
              const val = entry?.value
              if (typeof val === 'number') return sum + val
              if (val && typeof val === 'object') {
                const followersVal = val.followers ?? val.follower ?? val.followers_count ?? 0
                const nonFollowersVal = val.non_followers ?? val.non_follower ?? val.non_followers_count ?? 0
                const n = typeof val.total_value === 'number' ? val.total_value : (typeof val.value === 'number' ? val.value : (followersVal + nonFollowersVal))
                return sum + (typeof n === 'number' ? n : 0)
              }
              return sum
            }, 0)
          }

          // Helpers to pull follower breakdown values from totals responses
          const getTotalsBreakdown = (metricName: string): { followers: number; non_followers: number } => {
            if (aggregatedTotalsBreakdown && (metricName in aggregatedTotalsBreakdown)) {
              return aggregatedTotalsBreakdown[metricName]
            }
            const result = { followers: 0, non_followers: 0 }
            if (!insightsTotalsNumeric?.data) return result
            const m = insightsTotalsNumeric.data.find((metric: any) => metric.name === metricName)
            if (!m) return result
            
            // Check for total_value.breakdowns structure (metric_type=total_value with follow_type breakdown)
            if (m.total_value?.breakdowns) {
              for (const bd of m.total_value.breakdowns) {
                // Check if this breakdown is by follow_type
                const keys = bd.dimension_keys || []
                const hasFollowType = keys.includes('follow_type') || keys.includes('follower_type')
                if (hasFollowType) {
                  for (const r of (bd.results || [])) {
                    const dims = r.dimension_values || []
                    const val = typeof r.value === 'number' ? r.value : 0
                    for (const d of dims) {
                      const dUpper = String(d).toUpperCase()
                      if (dUpper === 'FOLLOWER') result.followers += val
                      else if (dUpper === 'NON_FOLLOWER') result.non_followers += val
                    }
                  }
                }
              }
              if (result.followers > 0 || result.non_followers > 0) return result
            }
            
            // Fallback to values array structure
            if (!Array.isArray(m.values)) return result
            for (const entry of m.values) {
              const val = entry?.value
              if (val && typeof val === 'object') {
                const followersVal = val.followers ?? val.follower ?? val.followers_count ?? 0
                const nonFollowersVal = val.non_followers ?? val.non_follower ?? val.non_followers_count ?? 0
                if (typeof followersVal === 'number') result.followers += followersVal
                if (typeof nonFollowersVal === 'number') result.non_followers += nonFollowersVal
              }
            }
            return result
          }

          // If all total_value sums are zero for the selected day range, try days_28 as a fallback
          const totalsPreview = {
            impressions: sumValuesTotals("views"),
            interactions: sumValuesTotals("total_interactions"),
            pviews: sumValuesTotals("profile_views"),
            wclicks: sumValuesTotals("website_clicks"),
          }
          if (!aggregatedTotalsNumeric && totalsPreview.impressions === 0 && totalsPreview.interactions === 0 && totalsPreview.pviews === 0 && totalsPreview.wclicks === 0) {
            const fallbackOrder: Array<"days_28" | "week" | "month" | "lifetime"> = ["days_28", "week", "month", "lifetime"]
            for (const p of fallbackOrder) {
              try {
                const res = await fetchTotalsNumeric(p)
                const prev = insightsTotalsNumeric // keep for safety
                insightsTotalsNumeric = res
                const check = {
                  impressions: sumValuesTotals("views"),
                  interactions: sumValuesTotals("total_interactions"),
                  pviews: sumValuesTotals("profile_views"),
                  wclicks: sumValuesTotals("website_clicks"),
                }
                if (check.impressions || check.interactions || check.pviews || check.wclicks) {
                  break
                } else {
                  insightsTotalsNumeric = prev
                }
              } catch {
                // try next period
              }
            }
          }

          // Extract follows / unfollows and growth from follows_and_unfollows metric
          const sumFollowMetric = (field: 'follows' | 'unfollows', source: any = insightsTotalsFollows): number => {
            if (!source?.data) return 0
            const m = source.data.find((metric: any) => metric.name === "follows_and_unfollows")
            if (!m) return 0
            
            // Check for total_value structure first (metric_type=total_value response)
            if (m.total_value !== undefined) {
              const tv = m.total_value
              // Direct value object with follows/unfollows
              if (tv && typeof tv === 'object' && typeof tv[field] === 'number') {
                return tv[field]
              }
              // Check in total_value.value object
              if (tv.value && typeof tv.value === 'object' && typeof tv.value[field] === 'number') {
                return tv.value[field]
              }
              // Sum from breakdowns if present
              if (tv.breakdowns) {
                let sum = 0
                for (const bd of tv.breakdowns) {
                  console.log(`[Instagram API] Checking breakdown for ${field}:`, JSON.stringify(bd, null, 2))
                  for (const r of (bd.results || [])) {
                    const dims = r.dimension_values || []
                    const val = typeof r.value === 'number' ? r.value : 0
                    console.log(`[Instagram API] Result: dims=${JSON.stringify(dims)}, val=${val}, field=${field}`)
                    
                    // For "follows" field: FOLLOWER and NON_FOLLOWER both represent new followers
                    if (field === 'follows') {
                      for (const d of dims) {
                        const dLower = String(d).toLowerCase()
                        if (dLower === 'follower' || dLower === 'non_follower' || dLower === 'nonfollower' ||
                            dLower === 'follow' || dLower === 'follows') {
                          console.log(`[Instagram API] Matched follows with dimension "${d}", value: ${val}`)
                          sum += val
                        }
                      }
                    }
                    // For "unfollows" field - API doesn't provide this directly, will be calculated later
                    if (field === 'unfollows') {
                      for (const d of dims) {
                        const dLower = String(d).toLowerCase()
                        if (dLower === 'unfollow' || dLower === 'unfollows') {
                          console.log(`[Instagram API] Matched unfollows with dimension "${d}", value: ${val}`)
                          sum += val
                        }
                      }
                    }
                    
                    // Also check if the result has direct follows/unfollows
                    if (r.value && typeof r.value === 'object' && typeof r.value[field] === 'number') {
                      sum += r.value[field]
                    }
                  }
                }
                if (sum > 0) return sum
              }
            }
            
            // Fallback to values array structure (time-series response)
            if (Array.isArray(m.values)) {
              const result = m.values.reduce((sum: number, entry: any) => {
                const val = entry?.value
                if (val && typeof val === 'object') {
                  const v = typeof val[field] === 'number' ? val[field] : 0
                  return sum + v
                }
                return sum
              }, 0)
              if (result > 0) return result
            }
            
            // Additional fallback: check for values array with breakdown structure
            if (Array.isArray(m.values)) {
              let sum = 0
              for (const entry of m.values) {
                // Check if entry has breakdowns
                if (entry?.breakdowns) {
                  for (const bd of entry.breakdowns) {
                    for (const r of (bd.results || [])) {
                      const dims = r.dimension_values || []
                      const val = typeof r.value === 'number' ? r.value : 0
                      for (const d of dims) {
                        if (matchesDimension(d)) sum += val
                      }
                    }
                  }
                }
              }
              if (sum > 0) return sum
            }
            
            return 0
          }
          let totalFollows = totalDays > 30 ? aggregatedFollows.follows : sumFollowMetric('follows')
          let totalUnfollows = totalDays > 30 ? aggregatedFollows.unfollows : sumFollowMetric('unfollows')
          
          if (debug) {
            console.log("[DEBUG][insights] totalDays:", totalDays)
            console.log("[DEBUG][insights] aggregatedFollows:", aggregatedFollows)
            console.log("[DEBUG][insights] totalFollows before fallback:", totalFollows)
            console.log("[DEBUG][insights] totalUnfollows before fallback:", totalUnfollows)
            // Log detailed structure of follows_and_unfollows metric
            if (insightsTotalsFollows?.data) {
              const followsMetric = insightsTotalsFollows.data.find((d: any) => d.name === 'follows_and_unfollows')
              if (followsMetric) {
                console.log("[DEBUG][insights] follows_and_unfollows metric found:", JSON.stringify(followsMetric, null, 2))
              } else {
                console.log("[DEBUG][insights] follows_and_unfollows metric NOT found in response")
                console.log("[DEBUG][insights] Available metrics:", insightsTotalsFollows.data.map((d: any) => d.name))
              }
            }
          }
          
          if (!aggregatedTotalsNumeric && totalFollows === 0 && totalUnfollows === 0) {
            try {
              const fallbackFollows = await fetchTotalsFollows("days_28")
              if (debug) {
                console.log("[DEBUG][insights] follows_and_unfollows days_28 raw:", JSON.stringify(fallbackFollows, null, 2))
              }
              totalFollows = sumFollowMetric('follows', fallbackFollows)
              totalUnfollows = sumFollowMetric('unfollows', fallbackFollows)
              if (debug) {
                console.log("[DEBUG][insights] totalFollows after days_28 fallback:", totalFollows)
                console.log("[DEBUG][insights] totalUnfollows after days_28 fallback:", totalUnfollows)
              }
            } catch {}
          }
          // Compute net growth from follower_count series if available (last - first)
          let netFollowerGrowth = totalFollows - totalUnfollows
          try {
            if (totalDays > 30) {
              // chunk follower_count series
              const chunks = buildChunks(startDate, endDate, 30)
              const all: Array<number> = []
              for (const c of chunks) {
                const s = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
                  metric: "follower_count",
                  period: "day",
                  since: Math.floor(new Date(c.since).getTime() / 1000).toString(),
                  until: Math.floor(new Date(c.until).getTime() / 1000).toString(),
                })
                const fc = s?.data?.find((d: any) => d.name === 'follower_count')
                const vals = (fc?.values || []).map((v: any) => v?.value).filter((n: any) => typeof n === 'number')
                all.push(...vals)
              }
              if (all.length >= 2) {
                const delta = all[all.length - 1] - all[0]
                if (netFollowerGrowth === 0 || Math.abs(delta) > Math.abs(netFollowerGrowth)) {
                  netFollowerGrowth = delta
                  // Calculate unfollows from follows and net growth
                  // unfollows = follows - net_growth
                  if (totalFollows > 0 && totalUnfollows === 0) {
                    totalUnfollows = Math.max(0, totalFollows - netFollowerGrowth)
                  }
                }
              }
            } else if (followerCountSeries?.data?.length) {
              const fc = followerCountSeries.data.find((d: any) => d.name === "follower_count")
              const values = fc?.values || []
              const first = values[0]?.value
              const last = values[values.length - 1]?.value
              if (typeof first === 'number' && typeof last === 'number') {
                const delta = last - first
                // If follows/unfollows are zero or clearly undercounted, prefer delta
                if (netFollowerGrowth === 0 || Math.abs(delta) > Math.abs(netFollowerGrowth)) {
                  netFollowerGrowth = delta
                  // Calculate unfollows from follows and net growth
                  // unfollows = follows - net_growth
                  if (totalFollows > 0 && totalUnfollows === 0) {
                    totalUnfollows = Math.max(0, totalFollows - netFollowerGrowth)
                    console.log(`[Instagram API] Calculated unfollows: ${totalUnfollows} (follows: ${totalFollows}, netGrowth: ${netFollowerGrowth})`)
                  }
                }
              }
            }
          } catch {}

          const processedInsights = {
            // Map 'views' metric to impressions label for UI
            impressions: sumValuesTotals("views"),
            reach: sumValuesSeries("reach"),
            content_interactions: sumValuesTotals("total_interactions"),
            profile_views: sumValuesTotals("profile_views"),
            website_clicks: sumValuesTotals("website_clicks"),
            follows: totalFollows,
            unfollows: totalUnfollows,
            net_follower_growth: netFollowerGrowth,
            followers_count: profileData.followers_count,
            follows_count: profileData.follows_count,
            media_count: profileData.media_count,
            // Follower/non-follower breakdowns when available
            reach_followers: reachFollowersSum,
            reach_non_followers: reachNonFollowersSum,
            profile_views_followers: getTotalsBreakdown('profile_views').followers,
            profile_views_non_followers: getTotalsBreakdown('profile_views').non_followers,
            content_interactions_followers: getTotalsBreakdown('total_interactions').followers,
            content_interactions_non_followers: getTotalsBreakdown('total_interactions').non_followers,
          }

          if (debug) {
            console.log("[DEBUG][insights] processed", JSON.stringify(processedInsights, null, 2))
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

      case "demographics":
        console.log("[Instagram API] Fetching demographics...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()

          // Calculate 90 days ago for demographics
          const ninetyDaysAgo = new Date()
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
          const demographicsSince = Math.floor(ninetyDaysAgo.getTime() / 1000).toString()
          const demographicsUntil = Math.floor(Date.now() / 1000).toString()

          if (debug) {
            console.log("[DEBUG][demographics] since:", demographicsSince, "until:", demographicsUntil)
          }

          // Fetch engaged audience demographics (country, city, age/gender)
          // Note: timeframe parameter is deprecated in v20+, use since/until instead
          const [countryRes, cityRes, ageGenderRes] = await Promise.all([
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "engaged_audience_demographics",
              period: "lifetime",
              breakdown: "country",
              metric_type: "total_value",
              since: demographicsSince,
              until: demographicsUntil,
            }).catch((e) => { console.error("[Demographics] Country fetch error:", e); return null }),
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "engaged_audience_demographics",
              period: "lifetime",
              breakdown: "city",
              metric_type: "total_value",
              since: demographicsSince,
              until: demographicsUntil,
            }).catch((e) => { console.error("[Demographics] City fetch error:", e); return null }),
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "engaged_audience_demographics",
              period: "lifetime",
              breakdown: "age,gender",
              metric_type: "total_value",
              since: demographicsSince,
              until: demographicsUntil,
            }).catch((e) => { console.error("[Demographics] Age/Gender fetch error:", e); return null }),
          ])

          if (debug) {
            console.log("[DEBUG][demographics] countryRes:", JSON.stringify(countryRes, null, 2))
            console.log("[DEBUG][demographics] cityRes:", JSON.stringify(cityRes, null, 2))
            console.log("[DEBUG][demographics] ageGenderRes:", JSON.stringify(ageGenderRes, null, 2))
          }

          // Parse demographics data - handle multiple possible response structures
          const parseBreakdownResults = (response: any, dimensionKey: string) => {
            if (!response?.data?.[0]) return []
            const metricData = response.data[0]
            
            // Try total_value.breakdowns structure first
            let results = metricData?.total_value?.breakdowns?.[0]?.results
            
            // Fallback to values array structure
            if (!results && metricData?.values) {
              results = metricData.values.flatMap((v: any) => {
                if (v.value && typeof v.value === 'object') {
                  return Object.entries(v.value).map(([key, val]) => ({
                    dimension_values: [key],
                    value: val,
                  }))
                }
                return []
              })
            }
            
            if (!results || !Array.isArray(results)) return []
            
            return results
              .map((r: any) => ({
                dimension: r.dimension_values?.find((v: string) => v !== "LAST_90_DAYS" && !v.includes("LAST_")) || r.dimension_values?.[1] || r.dimension_values?.[0],
                value: r.value || 0,
              }))
              .filter((r: any) => r.dimension && r.value > 0)
              .sort((a: any, b: any) => b.value - a.value)
          }

          const countries = parseBreakdownResults(countryRes, "country")
          const cities = parseBreakdownResults(cityRes, "city")
          
          if (debug) {
            console.log("[DEBUG][demographics] parsed countries:", countries.length, countries.slice(0, 3))
            console.log("[DEBUG][demographics] parsed cities:", cities.length, cities.slice(0, 3))
          }
          
          // Parse age/gender - Meta returns dimension_values like ["LAST_90_DAYS", "18-24", "M"]
          // or ["18-24", "M"] depending on the API version
          let ageGenderRaw = ageGenderRes?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []
          
          if (debug) {
            console.log("[DEBUG][demographics] ageGenderRaw count:", ageGenderRaw.length)
            console.log("[DEBUG][demographics] ageGenderRaw sample:", JSON.stringify(ageGenderRaw.slice(0, 3), null, 2))
            // Also log the dimension_keys to understand structure
            const dimensionKeys = ageGenderRes?.data?.[0]?.total_value?.breakdowns?.[0]?.dimension_keys
            console.log("[DEBUG][demographics] dimension_keys:", dimensionKeys)
          }
          
          // Fallback to values array structure (older API format)
          if (ageGenderRaw.length === 0 && ageGenderRes?.data?.[0]?.values) {
            ageGenderRaw = ageGenderRes.data[0].values.flatMap((v: any) => {
              if (v.value && typeof v.value === 'object') {
                return Object.entries(v.value).map(([key, val]) => ({
                  dimension_values: key.split(',').map((s: string) => s.trim()),
                  value: val,
                }))
              }
              return []
            })
          }
          
          // Get dimension_keys to understand what order the values are in
          const dimensionKeys = ageGenderRes?.data?.[0]?.total_value?.breakdowns?.[0]?.dimension_keys || []
          const ageIndex = dimensionKeys.findIndex((k: string) => k === "age")
          const genderIndex = dimensionKeys.findIndex((k: string) => k === "gender")
          
          const ageGender = ageGenderRaw
            .map((r: any) => {
              const dims = r.dimension_values || []
              
              // If we know the dimension order from dimension_keys, use that
              if (ageIndex !== -1 && genderIndex !== -1) {
                return {
                  age: dims[ageIndex] || "Unknown",
                  gender: dims[genderIndex] || "U",
                  value: r.value || 0,
                }
              }
              
              // Otherwise, filter out timeframe and try to detect age vs gender
              const filtered = dims.filter((d: string) => d && !String(d).includes("LAST_") && d !== "LAST_90_DAYS")
              
              // Age ranges contain "-" like "18-24", "25-34", etc.
              const ageValue = filtered.find((d: string) => /^\d+[-–]\d+$/.test(d) || /^\d+\+$/.test(d)) || filtered[0] || "Unknown"
              // Gender is typically M, F, or U
              const genderValue = filtered.find((d: string) => ["M", "F", "U"].includes(d?.toUpperCase?.())) || filtered[1] || "U"
              
              return {
                age: ageValue,
                gender: genderValue?.toUpperCase?.() || "U",
                value: r.value || 0,
              }
            })
            .filter((r: any) => r.value > 0 && r.age !== "Unknown")
            .sort((a: any, b: any) => b.value - a.value)
          
          if (debug) {
            console.log("[DEBUG][demographics] parsed ageGender:", ageGender.length, ageGender.slice(0, 3))
          }

          // Fetch follower demographics if available (using since/until instead of deprecated timeframe)
          let followerDemographics = null
          try {
            const followerRes = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
              metric: "follower_demographics",
              period: "lifetime",
              breakdown: "country",
              metric_type: "total_value",
              since: demographicsSince,
              until: demographicsUntil,
            })
            if (followerRes?.data?.[0]?.total_value?.breakdowns?.[0]?.results) {
              followerDemographics = {
                countries: parseBreakdownResults(followerRes, "country"),
              }
            }
          } catch {
            // Follower demographics may not be available for all accounts
          }

          return NextResponse.json({
            success: true,
            data: {
              engaged_audience: {
                countries: countries.slice(0, 15),
                cities: cities.slice(0, 15),
                age_gender: ageGender.slice(0, 20),
              },
              follower_demographics: followerDemographics,
            },
            period: "last_90_days",
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Demographics fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch demographics",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "online-followers":
        console.log("[Instagram API] Fetching online followers...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()

          const onlineRes = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
            metric: "online_followers",
            period: "lifetime",
          })

          if (debug) {
            console.log("[DEBUG][online-followers] Raw response:", JSON.stringify(onlineRes, null, 2))
          }

          // Parse online followers by hour - check multiple possible response structures
          let onlineFollowers = onlineRes?.data?.[0]?.values?.[0]?.value || {}
          
          // Fallback to total_value structure if values is empty
          if (Object.keys(onlineFollowers).length === 0 && onlineRes?.data?.[0]?.total_value?.value) {
            onlineFollowers = onlineRes.data[0].total_value.value
          }
          const hourlyData = Object.entries(onlineFollowers)
            .map(([hour, count]) => ({
              hour: parseInt(hour, 10),
              count: count as number,
            }))
            .sort((a, b) => a.hour - b.hour)

          // Find best times (top 3 hours)
          const bestTimes = [...hourlyData]
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((t) => t.hour)

          return NextResponse.json({
            success: true,
            data: {
              hourly: hourlyData,
              best_times: bestTimes,
              timezone: "UTC", // Note: IG returns in account timezone
            },
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Online followers fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch online followers data",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "reach-breakdown":
        console.log("[Instagram API] Fetching reach breakdown by media type...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()

          // Calculate timestamps for reach breakdown
          const reachSinceTs = Math.floor(new Date(startDate).getTime() / 1000).toString()
          const reachUntilTs = Math.floor(new Date(endDate).getTime() / 1000).toString()

          if (debug) {
            console.log("[DEBUG][reach-breakdown] startDate:", startDate, "endDate:", endDate)
            console.log("[DEBUG][reach-breakdown] sinceTs:", reachSinceTs, "untilTs:", reachUntilTs)
          }

          const reachBreakdown = await fetchInstagramData(`${instagramAccountId}/insights`, accessToken, {
            metric: "reach",
            period: "day",
            breakdown: "media_product_type",
            metric_type: "total_value",
            since: reachSinceTs,
            until: reachUntilTs,
          })

          if (debug) {
            console.log("[DEBUG][reach-breakdown] Raw response:", JSON.stringify(reachBreakdown, null, 2))
          }

          // Parse by media type - handle various content types
          const mediaTypeBreakdown: Record<string, number> = {
            FEED: 0,
            REELS: 0,
            STORY: 0,
            AD: 0,
          }

          const results = reachBreakdown?.data?.[0]?.total_value?.breakdowns?.[0]?.results || []
          
          if (debug) {
            console.log("[DEBUG][reach-breakdown] Parsed results:", results.length, "items")
          }
          
          results.forEach((r: any) => {
            const type = r.dimension_values?.[0]
            // Map various content type names to our categories
            // API returns: POST, CAROUSEL_CONTAINER, REEL, STORY, AD, LIVE
            if (type === "POST" || type === "CAROUSEL_CONTAINER" || type === "IMAGE" || type === "CAROUSEL_ALBUM") {
              mediaTypeBreakdown.FEED += r.value || 0
            } else if (type === "REEL" || type === "REELS" || type === "VIDEO") {
              mediaTypeBreakdown.REELS += r.value || 0
            } else if (type === "STORY") {
              mediaTypeBreakdown.STORY += r.value || 0
            } else if (type === "AD") {
              mediaTypeBreakdown.AD += r.value || 0
            } else if (type === "LIVE") {
              // Add LIVE to FEED for now, or could be separate category
              mediaTypeBreakdown.FEED += r.value || 0
            }
            
            if (debug) {
              console.log(`[DEBUG][reach-breakdown] Type: ${type}, Value: ${r.value}`)
            }
          })

          return NextResponse.json({
            success: true,
            data: mediaTypeBreakdown,
            period: { startDate, endDate },
            timestamp: new Date().toISOString(),
          })
        } catch (error) {
          console.error("[Instagram API] Reach breakdown fetch failed:", error)
          return NextResponse.json(
            {
              success: false,
              error: "Failed to fetch reach breakdown",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

  case "media":
      case "posts":
        console.log("[Instagram API] Fetching media...")
        try {
          const instagramAccountId = await resolveInstagramBusinessAccountId()

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
          // Note: In v22.0+, 'impressions' and 'plays' are deprecated - use 'views' instead
          // Different media types support different metrics - we'll fetch individually for VIDEO/CAROUSEL
          // since batch often fails for mixed media types
          let batchedInsights: any = null
          
          // Separate IMAGE posts (which work well with batch) from VIDEO/CAROUSEL (which often fail)
          const imagePosts = mediaData.data.filter((m: any) => m.media_type === "IMAGE")
          const videoPosts = mediaData.data.filter((m: any) => m.media_type === "VIDEO" || m.media_type === "CAROUSEL_ALBUM")
          
          // Batch fetch for IMAGE posts only
          if (imagePosts.length > 0) {
            try {
              const imageIds = imagePosts.map((m: any) => m.id)
              batchedInsights = await fetchInstagramData("", accessToken, {
                ids: imageIds.join(","),
                fields: `insights.metric(reach,total_interactions,shares,saved).period(lifetime){values}`,
              })
            } catch (batchErr) {
              console.warn("[Instagram API] Batch insights for images failed:", batchErr)
            }
          }
          
          if (debug) {
            const sampleId = mediaIds[0]
            console.log("[DEBUG][media] batched insights sample", sampleId, JSON.stringify(batchedInsights?.[sampleId]?.insights?.data || [], null, 2))
            console.log("[DEBUG][media] batched insights keys:", batchedInsights ? Object.keys(batchedInsights) : "null")
          }

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
            const raw = insightsMap.get(media.id) || { views: 0, reach: 0, total_interactions: 0, shares: 0, saved: 0 }
            // Normalize to keep existing downstream usage: map views -> impressions (for backwards compat), total_interactions -> engagement
            const insights = { impressions: raw.views || 0, reach: raw.reach || 0, engagement: raw.total_interactions || 0, shares: raw.shares || 0, saves: (raw as any).saved || 0 }
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

          // Fallback: Fetch insights for VIDEO/CAROUSEL individually (batch often fails for these)
          // Also fetch for any IMAGE posts that didn't get data from batch
          const needsFallback = mediaWithInsights
            .filter((m: any) => {
              // Always fetch VIDEO and CAROUSEL_ALBUM individually
              if (m.media_type === "VIDEO" || m.media_type === "CAROUSEL_ALBUM") return true
              // Also fetch if missing reach or saves
              return !m.insights || m.insights.reach === 0 || m.insights.saves === 0
            })
            .slice(0, 20) // Increased limit to cover more posts
          
          if (debug) {
            console.log("[DEBUG][media] needsFallback count:", needsFallback.length)
          }
          
          if (needsFallback.length) {
            // Fetch sequentially to avoid overwhelming the connection
            for (const m of needsFallback) {
              try {
                // Valid metrics per API error: impressions, reach, replies, saved, video_views, likes, 
                // comments, shares, total_interactions, follows, profile_visits, profile_activity, 
                // navigation, ig_reels_video_view_total_time, ig_reels_avg_watch_time, 
                // clips_replays_count, ig_reels_aggregated_all_plays_count, views
                // 
                // NOTE: 'plays' is DEPRECATED in v22.0+
                // NOTE: 'carousel_album_*' metrics are NOT supported - use standard metrics
                let metrics = "reach,saved,total_interactions,shares"
                
                if (m.media_type === "VIDEO") {
                  // For VIDEO/REEL - avoid deprecated 'plays' metric
                  // Use: reach, saved, shares, total_interactions, likes, comments
                  metrics = "reach,saved,shares,total_interactions"
                } else if (m.media_type === "CAROUSEL_ALBUM") {
                  // CAROUSEL_ALBUM uses standard metrics (not carousel_album_* prefix)
                  metrics = "reach,saved,total_interactions"
                }
                
                if (debug) {
                  console.log("[DEBUG][media] Fetching for", m.id, "type:", m.media_type, "metrics:", metrics)
                }
                
                const per = await fetchInstagramData(`${m.id}/insights`, accessToken, {
                  metric: metrics,
                  period: "lifetime",
                }, 2) // Reduce retries for fallback
                if (debug) {
                  console.log("[DEBUG][media] per-media insights", m.id, JSON.stringify(per?.data || [], null, 2))
                }
                if (Array.isArray(per?.data)) {
                  const map: Record<string, number> = {}
                  per.data.forEach((d: any) => {
                    const v = d?.values?.[0]?.value
                    map[d.name] = typeof v === 'number' ? v : 0
                  })
                  
                  // All media types now use standard metric names
                  const reachValue = map.reach || 0
                  m.insights.impressions = reachValue || m.insights.impressions
                  m.insights.reach = reachValue || m.insights.reach
                  m.insights.engagement = map.total_interactions || m.insights.engagement
                  m.insights.shares = map.shares || m.insights.shares
                  m.insights.saves = map.saved || m.insights.saves
                  
                  m.engagement_rate = calculateEngagementRate(
                    (m.like_count || 0) + (m.comments_count || 0),
                    m.insights.reach || 1,
                  )
                }
              } catch (err) {
                console.warn(`[Instagram API] Failed to fetch insights for media ${m.id} (${m.media_type}):`, err)
                // If the first attempt failed, try with just reach metric
                try {
                  const per2 = await fetchInstagramData(`${m.id}/insights`, accessToken, {
                    metric: "reach",
                    period: "lifetime",
                  }, 1)
                  if (Array.isArray(per2?.data) && per2.data.length > 0) {
                    const v = per2.data[0]?.values?.[0]?.value
                    if (typeof v === 'number') {
                      m.insights.reach = v
                    }
                  }
                } catch (err2) {
                  console.warn(`[Instagram API] Fallback for ${m.media_type} ${m.id} also failed:`, err2)
                }
              }
            }
          }

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
            availableEndpoints: ["test-connection", "account-info", "insights", "summary", "media", "posts", "demographics", "online-followers", "reach-breakdown"],
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

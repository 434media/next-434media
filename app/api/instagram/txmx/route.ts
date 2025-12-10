import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "../../../lib/auth"
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
            insightsTotalsNumeric = await fetchTotalsNumeric("day")
            if (debug) {
              console.log("[DEBUG][insights] totals day", JSON.stringify(insightsTotalsNumeric?.data || [], null, 2))
            }
          }

          // Total value metrics (object payload): follows_and_unfollows
          const fetchTotalsFollows = async (period: "day" | "days_28") =>
            fetchInstagramData(`${instagramAccountId}/insights`, accessToken, paramsWithWindow({
              metric: "follows_and_unfollows",
              metric_type: "total_value",
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
              if (m?.values) {
                for (const e of m.values) {
                  const v = e?.value
                  if (v && typeof v === 'object') {
                    aggregatedFollows.follows += typeof v.follows === 'number' ? v.follows : 0
                    aggregatedFollows.unfollows += typeof v.unfollows === 'number' ? v.unfollows : 0
                  }
                }
              }
            }
          } else {
            insightsTotalsFollows = await fetchTotalsFollows("day")
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

          // Helper for totals response
          const sumValuesTotals = (metricName: string): number => {
            if (aggregatedTotalsNumeric) return aggregatedTotalsNumeric[metricName] || 0
            const m = insightsTotalsNumeric.data.find((metric: any) => metric.name === metricName)
            if (!m || !Array.isArray(m.values)) return 0
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
            if (!m || !Array.isArray(m.values)) return result
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
            const m = source.data.find((metric: any) => metric.name === "follows_and_unfollows")
            if (!m || !Array.isArray(m.values)) return 0
            return m.values.reduce((sum: number, entry: any) => {
              const val = entry?.value
              if (val && typeof val === 'object') {
                const v = typeof val[field] === 'number' ? val[field] : 0
                return sum + v
              }
              return sum
            }, 0)
          }
          let totalFollows = totalDays > 30 ? aggregatedFollows.follows : sumFollowMetric('follows')
          let totalUnfollows = totalDays > 30 ? aggregatedFollows.unfollows : sumFollowMetric('unfollows')
          if (!aggregatedTotalsNumeric && totalFollows === 0 && totalUnfollows === 0) {
            try {
              const fallbackFollows = await fetchTotalsFollows("days_28")
              if (debug) {
                console.log("[DEBUG][insights] follows_and_unfollows days_28", JSON.stringify(fallbackFollows?.data || [], null, 2))
              }
              totalFollows = sumFollowMetric('follows', fallbackFollows)
              totalUnfollows = sumFollowMetric('unfollows', fallbackFollows)
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
          // Fetch insights for all media IDs in one request via Graph root using ids
          const batchedInsights = await fetchInstagramData("", accessToken, {
            ids: mediaIds.join(","),
            // 'engagement' is not a valid media metric; use total_interactions instead
            fields: `insights.metric(impressions,reach,total_interactions,shares,saved).period(lifetime){values}`,
          })
          if (debug) {
            const sampleId = mediaIds[0]
            console.log("[DEBUG][media] batched insights sample", sampleId, JSON.stringify(batchedInsights?.[sampleId]?.insights?.data || [], null, 2))
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
            const raw = insightsMap.get(media.id) || { impressions: 0, reach: 0, total_interactions: 0, shares: 0, saved: 0 }
            // Normalize to keep existing downstream usage: map total_interactions -> engagement
            const insights = { impressions: raw.impressions || 0, reach: raw.reach || 0, engagement: raw.total_interactions || 0, shares: raw.shares || 0, saves: (raw as any).saved || 0 }
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

          // Fallback: For any media missing reach/impressions, fetch individually
          const needsFallback = mediaWithInsights.filter((m: any) => !m.insights || (m.insights.impressions === 0 && m.insights.reach === 0))
          if (needsFallback.length) {
            await Promise.all(
              needsFallback.map(async (m: any) => {
                try {
                  const per = await fetchInstagramData(`${m.id}/insights`, accessToken, {
                    metric: "impressions,reach,total_interactions,shares,saved",
                    period: "lifetime",
                  })
                  if (debug) {
                    console.log("[DEBUG][media] per-media insights", m.id, JSON.stringify(per?.data || [], null, 2))
                  }
                  if (Array.isArray(per?.data)) {
                    const map: Record<string, number> = {}
                    per.data.forEach((d: any) => {
                      const v = d?.values?.[0]?.value
                      map[d.name] = typeof v === 'number' ? v : 0
                    })
                    m.insights.impressions = map.impressions || m.insights.impressions
                    m.insights.reach = map.reach || m.insights.reach
                    m.insights.engagement = map.total_interactions || m.insights.engagement
                    m.insights.shares = map.shares || m.insights.shares
                    m.insights.saves = (map as any).saved || m.insights.saves
                    m.engagement_rate = calculateEngagementRate(
                      (m.like_count || 0) + (m.comments_count || 0),
                      m.insights.reach || 1,
                    )
                  }
                } catch {}
              })
            )
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

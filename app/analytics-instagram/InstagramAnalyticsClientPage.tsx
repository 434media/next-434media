"use client"

import { useState, useEffect } from "react"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { InstagramDashboardHeader } from "../components/instagram/InstagramDashboardHeader"
import { InstagramMetricsOverview } from "../components/instagram/InstagramMetricsOverview"
import { InstagramTopPostsTable } from "../components/instagram/InstagramTopPostsTable"
import { InstagramAccountInfo } from "../components/instagram/InstagramAccountInfo"
import { InstagramDateRangeSelector } from "../components/instagram/InstagramDateRangeSelector"
import type {
  InstagramTimeRange,
  InstagramAccount,
  InstagramMedia,
  InstagramMediaInsights,
} from "../types/instagram-insights"

interface InstagramInsightsData {
  reach: number
  content_interactions: number
  profile_views: number
  // follower breakdowns provided by API
  reach_followers?: number
  reach_non_followers?: number
  profile_views_followers?: number
  profile_views_non_followers?: number
  content_interactions_followers?: number
  content_interactions_non_followers?: number
  website_clicks: number
  follows: number
  unfollows: number
  net_follower_growth: number
  followers_count: number
  follows_count: number
  media_count: number
}

type InstagramMediaWithInsights = InstagramMedia & {
  insights: InstagramMediaInsights
  engagement_rate: number
  hashtags: string[]
}

export default function InstagramAnalyticsClientPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<InstagramTimeRange>("30d")

  // Data states
  const [insightsData, setInsightsData] = useState<InstagramInsightsData | null>(null)
  const [accountData, setAccountData] = useState<InstagramAccount | null>(null)
  const [mediaData, setMediaData] = useState<InstagramMediaWithInsights[]>([])
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean
    message?: string
    account?: any
  } | null>(null)

  // Check for existing admin session
  useEffect(() => {
    const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (adminKey) {
      setIsAuthenticated(true)
      // Load properties immediately when authenticated
      loadInstagramData(adminKey)
    } else {
      setIsLoading(false)
    }
  }, [])

  // Load Instagram data when authenticated or date range changes
  useEffect(() => {
    if (isAuthenticated) {
      const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
      if (adminKey) {
        loadInstagramData(adminKey)
      }
    }
  }, [isAuthenticated, dateRange])

  const loadInstagramData = async (adminKey: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const headers = { "x-admin-key": adminKey }

      // Test connection first
      const connectionResponse = await fetch("/api/instagram/txmx?endpoint=test-connection", { headers })
      if (!connectionResponse.ok) {
        if (connectionResponse.status === 401) {
          sessionStorage.removeItem("adminKey")
          localStorage.removeItem("adminKey")
          setIsAuthenticated(false)
          return
        }
        // Try to surface server error details if available
        try {
          const errJson = await connectionResponse.json()
          const message = errJson?.error || errJson?.details || "Failed to connect to Instagram API"
          throw new Error(message)
        } catch {
          throw new Error("Failed to connect to Instagram API")
        }
      }
      const connectionData = await connectionResponse.json()
      setConnectionStatus(connectionData)

      // All other data can be fetched in parallel
      const startDate = getStartDateForRange(dateRange)
      const endDate = "today"

      const [accountRes, insightsRes, mediaRes] = await Promise.all([
        fetch("/api/instagram/txmx?endpoint=account-info", { headers }),
        fetch(`/api/instagram/txmx?endpoint=insights&startDate=${startDate}&endDate=${endDate}`, { headers }),
        fetch("/api/instagram/txmx?endpoint=media", { headers }),
      ])

      const [accountResult, insightsResult, mediaResult] = await Promise.all([
        (async () => {
          if (!accountRes.ok) throw new Error((await accountRes.json()).details || "Failed to fetch account info")
          return accountRes.json()
        })(),
        (async () => {
          if (!insightsRes.ok) throw new Error((await insightsRes.json()).details || "Failed to fetch insights")
          return insightsRes.json()
        })(),
        (async () => {
          if (!mediaRes.ok) throw new Error((await mediaRes.json()).details || "Failed to fetch media")
          return mediaRes.json()
        })(),
      ])

      if (accountResult.data) {
        setAccountData(accountResult.data)
      }

      if (insightsResult.data) {
        setInsightsData(insightsResult.data)
      }

      if (mediaResult.data) {
        const transformedMedia: InstagramMediaWithInsights[] = (mediaResult.data || []).map((media: any) => ({
          id: media.id,
          media_type: media.media_type,
          media_url: media.media_url,
          thumbnail_url: media.thumbnail_url,
          permalink: media.permalink,
          caption: media.caption || "",
          timestamp: media.timestamp,
          username: accountResult.data?.username || "txmxboxing", // Use fetched account username
          like_count: media.like_count || 0,
          comments_count: media.comments_count || 0,
          insights: {
            mediaId: media.id,
            impressions: media.insights?.impressions || 0,
            reach: media.insights?.reach || 0,
            engagement: media.insights?.engagement || 0,
            likes: media.like_count || 0,
            comments: media.comments_count || 0,
            shares: media.insights?.shares || 0,
            saves: media.insights?.saves || 0,
            videoViews: media.insights?.video_views || 0,
            _source: "instagram_api",
          },
          engagement_rate: media.engagement_rate || 0,
          hashtags: media.hashtags || [],
        }))
        setMediaData(transformedMedia)
      }
    } catch (err) {
      console.error("Error loading Instagram data:", err)
      setError(err instanceof Error ? err.message : "Failed to load Instagram data")
    } finally {
      setIsLoading(false)
    }
  }

  const getStartDateForRange = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d":
        return "yesterday"
      case "7d":
        return "7daysAgo"
      case "30d":
        return "30daysAgo"
      case "90d":
        return "90daysAgo"
      default:
        return "30daysAgo"
    }
  }

  const handleVerified = (password: string) => {
    sessionStorage.setItem("adminKey", password)
    setIsAuthenticated(true)
  }

  const handleRefresh = () => {
    const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (adminKey) {
      loadInstagramData(adminKey)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey")
    localStorage.removeItem("adminKey")
    setIsAuthenticated(false)
    // Reset all data states
    setInsightsData(null)
    setAccountData(null)
    setMediaData([])
    setConnectionStatus(null)
    setError(null)
  }

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <AdminPasswordModal
          isOpen={true}
          onVerified={handleVerified}
          onCancel={() => (window.location.href = "/")}
          action="access the instagram analytics dashboard"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 pt-32 md:pt-24">
        <InstagramDashboardHeader
          connectionStatus={connectionStatus}
          accountData={accountData}
          onRefresh={handleRefresh}
          onLogout={handleLogout}
          isLoading={isLoading}
        />

        <div className="mb-6 mt-6">
          <InstagramDateRangeSelector selectedRange={dateRange} onRangeChange={setDateRange} />
        </div>

        {/* Order: Account Info -> Date Range -> Top Posts -> Metrics Overview -> Engagement Chart */}
        {!isLoading && accountData &&
          <div className="mb-6">
            <InstagramAccountInfo account={accountData} />
          </div>
        }

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-200">Error: {error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-white text-lg">Loading Instagram analytics...</div>
          </div>
        ) : (
          <div className="space-y-6">
            <InstagramTopPostsTable
              media={mediaData}
              followerCount={accountData?.followers_count || 0}
              connectionStatus={connectionStatus}
            />

            <InstagramMetricsOverview
              insights={
                insightsData || {
                  reach: 0,
                  content_interactions: 0,
                  profile_views: 0,
                  reach_followers: 0,
                  reach_non_followers: 0,
                  profile_views_followers: 0,
                  profile_views_non_followers: 0,
                  content_interactions_followers: 0,
                  content_interactions_non_followers: 0,
                  website_clicks: 0,
                  follows: 0,
                  unfollows: 0,
                  net_follower_growth: 0,
                  followers_count: 0,
                  follows_count: 0,
                  media_count: 0,
                }
              }
              dateRange={dateRange}
              connectionStatus={connectionStatus}
            />
          </div>
        )}
      </div>
    </div>
  )
}

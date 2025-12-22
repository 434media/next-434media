"use client"

import { useState, useEffect } from "react"
import { InstagramAnalyticsHeader } from "../../components/instagram/InstagramAnalyticsHeader"
import { InstagramMetricsOverview } from "../../components/instagram/InstagramMetricsOverview"
import { InstagramTopPostsTable } from "../../components/instagram/InstagramTopPostsTable"
import { InstagramAccountInfo } from "../../components/instagram/InstagramAccountInfo"
import { InfoTooltip } from "../../components/analytics/InfoTooltip"
import type {
  InstagramTimeRange,
  InstagramAccount,
  InstagramMedia,
  InstagramMediaInsights,
} from "../../types/instagram-insights"

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

// Helper to format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString()
}

// Download Instagram analytics as CSV
function downloadInstagramCSV(
  dateRange: InstagramTimeRange, 
  accountData: InstagramAccount | null, 
  insightsData: InstagramInsightsData | null,
  mediaData: InstagramMediaWithInsights[]
) {
  const today = new Date().toISOString().split('T')[0]
  const accountName = accountData?.username || 'instagram'
  const filename = `${accountName}-instagram-${dateRange}-${today}.csv`
  
  let csvContent = `${accountData?.name || 'Instagram'} Analytics Report\n`
  csvContent += `Account: @${accountData?.username || 'unknown'}\n`
  csvContent += `Date Range: Last ${dateRange === '1d' ? '24 hours' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}\n`
  csvContent += `Generated: ${new Date().toLocaleString()}\n\n`
  
  // Key Metrics
  csvContent += "=== KEY METRICS ===\n"
  csvContent += "Metric,Value\n"
  if (insightsData) {
    csvContent += `Followers,${insightsData.followers_count}\n`
    csvContent += `Reach,${insightsData.reach}\n`
    csvContent += `Profile Views,${insightsData.profile_views}\n`
    csvContent += `Content Interactions,${insightsData.content_interactions}\n`
    csvContent += `Website Clicks,${insightsData.website_clicks}\n`
    csvContent += `New Followers,${insightsData.follows}\n`
    csvContent += `Unfollows,${insightsData.unfollows}\n`
    csvContent += `Net Growth,${insightsData.net_follower_growth}\n`
  }
  
  // Top Posts
  if (mediaData.length > 0) {
    csvContent += "\n=== TOP POSTS ===\n"
    csvContent += "Caption,Likes,Comments,Reach,Engagement Rate,Date\n"
    mediaData.slice(0, 10).forEach(post => {
      const caption = (post.caption || '').substring(0, 50).replace(/"/g, '""').replace(/\n/g, ' ')
      csvContent += `"${caption}",${post.like_count},${post.comments_count},${post.insights?.reach || 0},${(post.engagement_rate * 100).toFixed(2)}%,${new Date(post.timestamp).toLocaleDateString()}\n`
    })
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Download Instagram analytics as PNG
function downloadInstagramPNG(
  dateRange: InstagramTimeRange,
  accountData: InstagramAccount | null,
  insightsData: InstagramInsightsData | null,
  mediaData: InstagramMediaWithInsights[]
) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    alert('Unable to create canvas. Please try again.')
    return
  }
  
  canvas.width = 1200
  canvas.height = 800
  
  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Pink gradient accent bar
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, '#ec4899')
  gradient.addColorStop(1, '#a855f7')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, 6)
  
  // Header
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${accountData?.name || 'Instagram'} Analytics`, 60, 70)
  
  ctx.fillStyle = '#9ca3af'
  ctx.font = '16px system-ui, -apple-system, sans-serif'
  ctx.fillText(`@${accountData?.username || 'instagram'}`, 60, 100)
  
  ctx.fillStyle = '#9ca3af'
  ctx.font = '18px system-ui, -apple-system, sans-serif'
  ctx.fillText(`Period: Last ${dateRange === '1d' ? '24 hours' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : '90 days'}`, 60, 130)
  
  ctx.fillStyle = '#6b7280'
  ctx.font = '14px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, canvas.width - 60, 70)
  
  // Divider
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(60, 160)
  ctx.lineTo(canvas.width - 60, 160)
  ctx.stroke()
  
  // Metrics cards
  const metrics = insightsData ? [
    { label: 'Followers', value: formatNumber(insightsData.followers_count) },
    { label: 'Reach', value: formatNumber(insightsData.reach) },
    { label: 'Profile Views', value: formatNumber(insightsData.profile_views) },
    { label: 'Interactions', value: formatNumber(insightsData.content_interactions) },
    { label: 'Website Clicks', value: formatNumber(insightsData.website_clicks) },
    { label: 'New Followers', value: formatNumber(insightsData.follows) },
    { label: 'Unfollows', value: formatNumber(insightsData.unfollows) },
    { label: 'Net Growth', value: (insightsData.net_follower_growth >= 0 ? '+' : '') + formatNumber(insightsData.net_follower_growth) },
  ] : []
  
  const cardWidth = 250
  const cardHeight = 100
  const cardsPerRow = 4
  const startX = 60
  const startY = 200
  const gapX = 30
  const gapY = 20
  
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / cardsPerRow)
    const col = index % cardsPerRow
    const x = startX + col * (cardWidth + gapX)
    const y = startY + row * (cardHeight + gapY)
    
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.roundRect(x, y, cardWidth, cardHeight, 12)
    ctx.fill()
    
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(metric.label.toUpperCase(), x + 20, y + 30)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
    ctx.fillText(metric.value, x + 20, y + 70)
  })
  
  // Top Posts section
  let currentY = startY + 2 * (cardHeight + gapY) + 40
  
  if (mediaData.length > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Top Posts', 60, currentY)
    
    currentY += 40
    
    const tableX = 60
    const tableWidth = canvas.width - 120
    const rowHeight = 35
    
    // Header
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(tableX, currentY, tableWidth, rowHeight)
    
    ctx.fillStyle = '#9ca3af'
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.fillText('CAPTION', tableX + 15, currentY + 22)
    ctx.textAlign = 'center'
    ctx.fillText('LIKES', tableX + tableWidth * 0.6, currentY + 22)
    ctx.fillText('COMMENTS', tableX + tableWidth * 0.75, currentY + 22)
    ctx.textAlign = 'right'
    ctx.fillText('ENGAGEMENT', tableX + tableWidth - 15, currentY + 22)
    
    currentY += rowHeight
    
    mediaData.slice(0, 5).forEach((post, index) => {
      ctx.fillStyle = index % 2 === 0 ? '#111827' : '#0a0a0a'
      ctx.fillRect(tableX, currentY, tableWidth, rowHeight)
      
      const caption = (post.caption || 'No caption').substring(0, 45)
      ctx.fillStyle = '#e5e7eb'
      ctx.font = '13px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(caption + (post.caption && post.caption.length > 45 ? '...' : ''), tableX + 15, currentY + 22)
      
      ctx.fillStyle = '#ec4899'
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(formatNumber(post.like_count), tableX + tableWidth * 0.6, currentY + 22)
      ctx.fillText(formatNumber(post.comments_count), tableX + tableWidth * 0.75, currentY + 22)
      
      ctx.textAlign = 'right'
      ctx.fillText(`${(post.engagement_rate * 100).toFixed(1)}%`, tableX + tableWidth - 15, currentY + 22)
      
      currentY += rowHeight
    })
  }
  
  // Footer
  ctx.fillStyle = '#6b7280'
  ctx.font = '12px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Powered by Meta Business Suite • 434 Media', canvas.width / 2, canvas.height - 40)
  
  // Bottom gradient
  const bottomGradient = ctx.createLinearGradient(0, canvas.height - 6, canvas.width, canvas.height - 6)
  bottomGradient.addColorStop(0, '#ec4899')
  bottomGradient.addColorStop(1, '#a855f7')
  ctx.fillStyle = bottomGradient
  ctx.fillRect(0, canvas.height - 6, canvas.width, 6)
  
  // Download
  const today = new Date().toISOString().split('T')[0]
  const link = document.createElement('a')
  link.download = `${accountData?.username || 'instagram'}-analytics-${dateRange}-${today}.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function InstagramAnalyticsClientPage() {
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

  // Load Instagram data on component mount and when date range changes
  useEffect(() => {
    loadInstagramData()
  }, [dateRange])

  const loadInstagramData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Test connection first
      const connectionResponse = await fetch("/api/instagram/txmx?endpoint=test-connection")
      if (!connectionResponse.ok) {
        if (connectionResponse.status === 401) {
          window.location.href = "/admin"
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
        fetch("/api/instagram/txmx?endpoint=account-info"),
        fetch(`/api/instagram/txmx?endpoint=insights&startDate=${startDate}&endDate=${endDate}`),
        fetch("/api/instagram/txmx?endpoint=media"),
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

  const handleRefresh = () => {
    loadInstagramData()
  }

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    window.location.href = "/admin"
  }

  const handleDownloadCSV = () => {
    downloadInstagramCSV(dateRange, accountData, insightsData, mediaData)
  }

  const handleDownloadPNG = () => {
    downloadInstagramPNG(dateRange, accountData, insightsData, mediaData)
  }

  return (
    <div className="min-h-screen bg-black pt-[56px] md:pt-[64px] overflow-hidden w-full max-w-full">
      {/* Unified Sticky Instagram Header */}
      <div className="sticky top-[56px] md:top-[64px] z-40 overflow-hidden">
        <InstagramAnalyticsHeader
          onRefresh={handleRefresh}
          onLogout={handleLogout}
          isLoading={isLoading}
          accountData={accountData}
          connectionStatus={connectionStatus}
          selectedRange={dateRange}
          onRangeChange={setDateRange}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPNG={handleDownloadPNG}
        />
      </div>

      <div className="py-4 sm:py-6 overflow-hidden w-full">
        <div className="mx-auto px-3 sm:px-4 max-w-7xl overflow-hidden w-full">
          {/* Error Display */}
          {error && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-md transition-colors mt-2 text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Account Info */}
          {!isLoading && accountData && (
            <div className="mb-10 sm:mb-12">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                <h2 className="text-sm sm:text-lg font-semibold text-white">Account Overview</h2>
                <InfoTooltip content="Your Instagram Business account information including follower count, posts, and profile details." />
              </div>
              <InstagramAccountInfo account={accountData} />
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-white/60 text-sm">Loading Instagram analytics...</p>
            </div>
          ) : (
            <>
              {/* Top Posts */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                  <h2 className="text-sm sm:text-lg font-semibold text-white">Top Performing Posts</h2>
                  <InfoTooltip content="Your most engaging posts ranked by likes, comments, and overall engagement rate. Engagement rate is calculated as (likes + comments) / followers." />
                </div>
                <InstagramTopPostsTable
                  media={mediaData}
                  followerCount={accountData?.followers_count || 0}
                  connectionStatus={connectionStatus}
                />
              </div>

              {/* Metrics Overview */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                  <h2 className="text-sm sm:text-lg font-semibold text-white">Key Metrics</h2>
                  <InfoTooltip content="Instagram insights including reach, profile views, content interactions, and follower growth over the selected time period." />
                </div>
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
            </>
          )}

          {/* Footer */}
          <div className="text-center text-white/40 text-sm pt-8 pb-4">
            <p>
              Powered by Meta Business Suite <span className="hidden md:inline">•</span>{" "}
              <span className="block md:inline">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { InstagramAnalyticsHeader } from "../../components/instagram/InstagramAnalyticsHeader"
import { InstagramKeyMetrics } from "../../components/instagram/InstagramKeyMetrics"
import { InstagramTopPostsTable } from "../../components/instagram/InstagramTopPostsTable"
import { InstagramAccountInfo } from "../../components/instagram/InstagramAccountInfo"
import { InstagramReachBreakdown } from "../../components/instagram/InstagramReachBreakdown"
import { InfoTooltip } from "../../components/analytics/InfoTooltip"
import type {
  InstagramTimeRange,
  InstagramAccount,
  InstagramMedia,
  InstagramMediaInsights,
  InstagramReachBreakdown as InstagramReachBreakdownType,
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
  
  // Primary KPIs
  csvContent += "=== PRIMARY KPIs ===\n"
  csvContent += "Metric,Value,Notes\n"
  if (insightsData) {
    const engagementRate = insightsData.followers_count > 0 
      ? ((insightsData.content_interactions / insightsData.followers_count) * 100).toFixed(2)
      : "0.00"
    const reachRate = insightsData.followers_count > 0
      ? ((insightsData.reach / insightsData.followers_count) * 100).toFixed(1)
      : "0.0"
    const followerGrowthRate = insightsData.followers_count > 0
      ? ((insightsData.net_follower_growth / insightsData.followers_count) * 100).toFixed(2)
      : "0.00"
    const profileToWebsite = insightsData.profile_views > 0
      ? ((insightsData.website_clicks / insightsData.profile_views) * 100).toFixed(2)
      : "0.00"
    const reachToProfile = insightsData.reach > 0
      ? ((insightsData.profile_views / insightsData.reach) * 100).toFixed(2)
      : "0.00"
    
    csvContent += `Total Followers,${insightsData.followers_count},Current audience size\n`
    csvContent += `Accounts Reached,${insightsData.reach},${reachRate}% of followers\n`
    csvContent += `Engagement Rate,${engagementRate}%,Industry avg: 1-3%\n`
    csvContent += `Website Clicks,${insightsData.website_clicks},Key conversion metric\n`
  }
  
  // Secondary Metrics
  csvContent += "\n=== SECONDARY METRICS ===\n"
  csvContent += "Metric,Value\n"
  if (insightsData) {
    csvContent += `Profile Views,${insightsData.profile_views}\n`
    csvContent += `Content Interactions,${insightsData.content_interactions}\n`
    csvContent += `New Followers,${insightsData.follows}\n`
    csvContent += `Unfollows,${insightsData.unfollows}\n`
    csvContent += `Net Follower Growth,${insightsData.net_follower_growth}\n`
    csvContent += `Posts Published,${insightsData.media_count}\n`
  }
  
  // Marketing Funnel
  csvContent += "\n=== MARKETING FUNNEL ===\n"
  csvContent += "Stage,Value,Conversion Rate\n"
  if (insightsData) {
    const reachToProfile = insightsData.reach > 0
      ? ((insightsData.profile_views / insightsData.reach) * 100).toFixed(2)
      : "0.00"
    const profileToWebsite = insightsData.profile_views > 0
      ? ((insightsData.website_clicks / insightsData.profile_views) * 100).toFixed(2)
      : "0.00"
    
    csvContent += `Reach,${insightsData.reach},Top of funnel\n`
    csvContent += `Profile Views,${insightsData.profile_views},${reachToProfile}% from reach\n`
    csvContent += `Website Clicks,${insightsData.website_clicks},${profileToWebsite}% from profile\n`
    csvContent += `New Followers,${insightsData.follows},Conversions\n`
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
  canvas.height = 1000
  
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
  
  // Calculate derived metrics
  const engagementRate = insightsData && insightsData.followers_count > 0 
    ? ((insightsData.content_interactions / insightsData.followers_count) * 100).toFixed(2)
    : "0.00"
  const reachRate = insightsData && insightsData.followers_count > 0
    ? ((insightsData.reach / insightsData.followers_count) * 100).toFixed(1)
    : "0.0"
  const reachToProfile = insightsData && insightsData.reach > 0
    ? ((insightsData.profile_views / insightsData.reach) * 100).toFixed(2)
    : "0.00"
  const profileToWebsite = insightsData && insightsData.profile_views > 0
    ? ((insightsData.website_clicks / insightsData.profile_views) * 100).toFixed(2)
    : "0.00"
  
  // Primary KPIs section
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('PRIMARY KPIs', 60, 200)
  
  const primaryMetrics = insightsData ? [
    { label: 'Total Followers', value: formatNumber(insightsData.followers_count), trend: insightsData.net_follower_growth >= 0 ? `+${formatNumber(insightsData.net_follower_growth)}` : formatNumber(insightsData.net_follower_growth), trendColor: insightsData.net_follower_growth >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Accounts Reached', value: formatNumber(insightsData.reach), trend: `${reachRate}% of followers`, trendColor: '#ec4899' },
    { label: 'Engagement Rate', value: `${engagementRate}%`, trend: parseFloat(engagementRate) >= 3 ? 'Above avg' : parseFloat(engagementRate) >= 1 ? 'Average' : 'Below avg', trendColor: parseFloat(engagementRate) >= 3 ? '#22c55e' : parseFloat(engagementRate) >= 1 ? '#eab308' : '#ef4444' },
    { label: 'Website Clicks', value: formatNumber(insightsData.website_clicks), trend: `${profileToWebsite}% conversion`, trendColor: '#ec4899' },
  ] : []
  
  const cardWidth = 250
  const cardHeight = 100
  const startX = 60
  const startY = 220
  const gapX = 30
  
  primaryMetrics.forEach((metric, index) => {
    const x = startX + index * (cardWidth + gapX)
    const y = startY
    
    // Card background with gradient
    const cardGradient = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight)
    cardGradient.addColorStop(0, '#1f2937')
    cardGradient.addColorStop(1, '#111827')
    ctx.fillStyle = cardGradient
    ctx.beginPath()
    ctx.roundRect(x, y, cardWidth, cardHeight, 12)
    ctx.fill()
    
    // Border
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.stroke()
    
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(metric.label.toUpperCase(), x + 20, y + 25)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif'
    ctx.fillText(metric.value, x + 20, y + 60)
    
    ctx.fillStyle = metric.trendColor
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.fillText(metric.trend, x + 20, y + 85)
  })
  
  // Secondary Metrics row
  let currentY = startY + cardHeight + 40
  
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('SECONDARY METRICS', 60, currentY)
  currentY += 20
  
  const secondaryMetrics = insightsData ? [
    { label: 'Profile Views', value: formatNumber(insightsData.profile_views), color: '#3b82f6' },
    { label: 'Interactions', value: formatNumber(insightsData.content_interactions), color: '#ec4899' },
    { label: 'New Followers', value: formatNumber(insightsData.follows), color: '#22c55e' },
    { label: 'Unfollows', value: formatNumber(insightsData.unfollows), color: '#ef4444' },
  ] : []
  
  const smallCardWidth = 180
  const smallCardHeight = 70
  
  secondaryMetrics.forEach((metric, index) => {
    const x = startX + index * (smallCardWidth + 20)
    const y = currentY
    
    ctx.fillStyle = '#1f293780'
    ctx.beginPath()
    ctx.roundRect(x, y, smallCardWidth, smallCardHeight, 8)
    ctx.fill()
    
    ctx.fillStyle = metric.color
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(metric.value, x + smallCardWidth / 2, y + 35)
    
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.fillText(metric.label, x + smallCardWidth / 2, y + 55)
  })
  
  // Marketing Funnel
  currentY += smallCardHeight + 50
  
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('MARKETING FUNNEL', 60, currentY)
  currentY += 30
  
  if (insightsData) {
    const funnelData = [
      { label: 'Reach', value: insightsData.reach, color: '#ffffff' },
      { label: 'Profile Views', value: insightsData.profile_views, rate: reachToProfile, color: '#3b82f6' },
      { label: 'Website Clicks', value: insightsData.website_clicks, rate: profileToWebsite, color: '#ec4899' },
      { label: 'New Followers', value: insightsData.follows, color: '#22c55e' },
    ]
    
    const funnelWidth = 200
    const funnelSpacing = 80
    
    funnelData.forEach((stage, index) => {
      const x = 100 + index * (funnelWidth + funnelSpacing)
      const y = currentY
      
      // Value
      ctx.fillStyle = stage.color
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(formatNumber(stage.value), x + funnelWidth / 2, y + 20)
      
      // Label
      ctx.fillStyle = '#9ca3af'
      ctx.font = '12px system-ui, -apple-system, sans-serif'
      ctx.fillText(stage.label, x + funnelWidth / 2, y + 45)
      
      // Conversion rate arrow
      if (stage.rate && index > 0) {
        ctx.fillStyle = '#6b7280'
        ctx.font = '11px system-ui, -apple-system, sans-serif'
        ctx.fillText(`${stage.rate}%`, x - funnelSpacing / 2 + funnelWidth / 2, y + 10)
        
        // Arrow
        ctx.strokeStyle = '#4b5563'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - funnelSpacing + 20, y + 20)
        ctx.lineTo(x - 20, y + 20)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 25, y + 15)
        ctx.lineTo(x - 15, y + 20)
        ctx.lineTo(x - 25, y + 25)
        ctx.stroke()
      }
    })
  }
  
  // Top Posts section
  currentY += 80
  
  if (mediaData.length > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('TOP POSTS', 60, currentY)
    
    currentY += 30
    
    const tableX = 60
    const tableWidth = canvas.width - 120
    const rowHeight = 35
    
    // Header
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(tableX, currentY, tableWidth, rowHeight)
    
    ctx.fillStyle = '#9ca3af'
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
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
  const [selectedAccount, setSelectedAccount] = useState("txmx")

  // Data states
  const [insightsData, setInsightsData] = useState<InstagramInsightsData | null>(null)
  const [accountData, setAccountData] = useState<InstagramAccount | null>(null)
  const [mediaData, setMediaData] = useState<InstagramMediaWithInsights[]>([])
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean
    message?: string
    account?: any
  } | null>(null)
  
  // New analytics data states
  const [reachBreakdownData, setReachBreakdownData] = useState<InstagramReachBreakdownType | null>(null)

  // Load Instagram data on component mount and when date range or account changes
  useEffect(() => {
    loadInstagramData()
  }, [dateRange, selectedAccount])

  // Handle account change
  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId)
    // Note: Currently only txmx is connected. Other accounts would need their own API routes.
  }

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
        let errorMessage = "Failed to connect to Instagram API"
        try {
          const errJson = await connectionResponse.json()
          errorMessage = errJson?.details || errJson?.error || errorMessage
          if (errJson?.missingVariables?.length) {
            errorMessage += `. Missing: ${errJson.missingVariables.join(", ")}`
          }
          if (errJson?.missingPermissions?.length) {
            errorMessage += `. Missing permissions: ${errJson.missingPermissions.join(", ")}`
          }
        } catch {
          // JSON parsing failed, use default message
        }
        throw new Error(errorMessage)
      }
      const connectionData = await connectionResponse.json()
      setConnectionStatus(connectionData)

      // All other data can be fetched in parallel
      const startDate = getStartDateForRange(dateRange)
      const endDate = "today"

      // Fetch data with individual error handling - don't fail entirely if one request fails
      const [accountRes, insightsRes, mediaRes] = await Promise.all([
        fetch("/api/instagram/txmx?endpoint=account-info").catch(() => null),
        fetch(`/api/instagram/txmx?endpoint=insights&startDate=${startDate}&endDate=${endDate}`).catch(() => null),
        fetch("/api/instagram/txmx?endpoint=media").catch(() => null),
      ])

      // Process account data
      if (accountRes?.ok) {
        try {
          const accountResult = await accountRes.json()
          if (accountResult.data) {
            setAccountData(accountResult.data)
          }
        } catch {
          console.warn("Failed to parse account data")
        }
      }

      // Process insights data
      if (insightsRes?.ok) {
        try {
          const insightsResult = await insightsRes.json()
          if (insightsResult.data) {
            setInsightsData(insightsResult.data)
          }
        } catch {
          console.warn("Failed to parse insights data")
        }
      }

      // Process media data
      if (mediaRes?.ok) {
        try {
          const mediaResult = await mediaRes.json()
          if (mediaResult.data) {
            const transformedMedia: InstagramMediaWithInsights[] = (mediaResult.data || []).map((media: any) => ({
              id: media.id,
              media_type: media.media_type,
              media_url: media.media_url,
              thumbnail_url: media.thumbnail_url,
              permalink: media.permalink,
              caption: media.caption || "",
              timestamp: media.timestamp,
              username: accountData?.username || "txmxboxing",
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
        } catch {
          console.warn("Failed to parse media data")
        }
      } else if (mediaRes && !mediaRes.ok) {
        // Log media fetch failure but don't throw - other data may still be useful
        console.warn("Media fetch returned error, continuing with other data")
      }
      
      // Fetch reach breakdown by media type
      try {
        const reachStartDate = getStartDateForRange(dateRange)
        const reachBreakdownRes = await fetch(`/api/instagram/txmx?endpoint=reach-breakdown&startDate=${reachStartDate}&endDate=today&debug=true`)
        console.log("[ReachBreakdown] Fetching for range:", reachStartDate)
        if (reachBreakdownRes.ok) {
          const reachBreakdownResult = await reachBreakdownRes.json()
          console.log("[ReachBreakdown] API Response:", reachBreakdownResult)
          if (reachBreakdownResult.data) {
            setReachBreakdownData(reachBreakdownResult.data)
          }
        } else {
          console.warn("[ReachBreakdown] API returned:", reachBreakdownRes.status, await reachBreakdownRes.text().catch(() => ""))
        }
      } catch (err) {
        console.warn("[ReachBreakdown] Fetch error:", err)
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
  
  const getDateRangeLabel = (range: InstagramTimeRange): string => {
    switch (range) {
      case "1d":
        return "Last 24 hours"
      case "7d":
        return "Last 7 days"
      case "30d":
        return "Last 30 days"
      case "90d":
        return "Last 90 days"
      default:
        return "Selected period"
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
    <div className="bg-black w-full overflow-x-hidden">
      {/* Instagram Header */}
      <div className="w-full overflow-x-hidden">
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
          selectedAccount={selectedAccount}
          onAccountChange={handleAccountChange}
        />
      </div>

      <div className="py-4 sm:py-6 w-full overflow-x-hidden">
        <div className="px-3 sm:px-4 lg:px-6 w-full overflow-x-hidden">
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
              {/* Key Metrics - Primary KPIs for Sales & Marketing */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                  <h2 className="text-sm sm:text-lg font-semibold text-white">Key Metrics</h2>
                  <InfoTooltip content="Core performance indicators for sales and marketing: audience size, reach, engagement rate, and website conversions." />
                </div>
                <InstagramKeyMetrics
                  insights={
                    insightsData || {
                      reach: 0,
                      content_interactions: 0,
                      profile_views: 0,
                      reach_followers: 0,
                      reach_non_followers: 0,
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

              {/* Content Performance */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h2 className="text-sm sm:text-lg font-semibold text-white">Content Performance</h2>
                  <InfoTooltip content="See how your reach is distributed across different content types: Feed posts, Reels, Stories, and Promoted content." />
                </div>
                <InstagramReachBreakdown
                  breakdown={reachBreakdownData}
                  isLoading={isLoading}
                  dateRange={getDateRangeLabel(dateRange)}
                />
              </div>

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

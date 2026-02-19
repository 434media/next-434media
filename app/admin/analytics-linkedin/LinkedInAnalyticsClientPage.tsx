"use client"

import { useState, useEffect } from "react"
import { LinkedInAnalyticsHeader } from "@/components/linkedin/LinkedInAnalyticsHeader"
import { LinkedInKeyMetrics } from "@/components/linkedin/LinkedInKeyMetrics"
import { LinkedInOrganizationInfo } from "@/components/linkedin/LinkedInOrganizationInfo"
import { LinkedInTopPostsTable } from "@/components/linkedin/LinkedInTopPostsTable"
import { InfoTooltip } from "@/components/analytics/InfoTooltip"
import type {
  LinkedInTimeRange,
  LinkedInOrganization,
  LinkedInOrganizationInsights,
  LinkedInPostWithInsights,
} from "@/types/linkedin-insights"

// Helper to format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString()
}

// Download LinkedIn analytics as CSV
function downloadLinkedInCSV(
  dateRange: LinkedInTimeRange,
  organizationData: LinkedInOrganization | null,
  insightsData: LinkedInOrganizationInsights | null,
  postsData: LinkedInPostWithInsights[]
) {
  const today = new Date().toISOString().split("T")[0]
  const orgName = organizationData?.vanityName || "linkedin"
  const filename = `${orgName}-linkedin-${dateRange}-${today}.csv`

  let csvContent = `${organizationData?.name || "LinkedIn"} Analytics Report\n`
  csvContent += `Organization: ${organizationData?.name || "unknown"}\n`
  csvContent += `Date Range: Last ${
    dateRange === "7d"
      ? "7 days"
      : dateRange === "30d"
      ? "30 days"
      : dateRange === "90d"
      ? "90 days"
      : "12 months"
  }\n`
  csvContent += `Generated: ${new Date().toLocaleString()}\n\n`

  // Primary KPIs
  csvContent += "=== PRIMARY KPIs ===\n"
  csvContent += "Metric,Value,Notes\n"
  if (insightsData) {
    const engagementRate =
      insightsData.impressions > 0
        ? ((insightsData.totalEngagements / insightsData.impressions) * 100).toFixed(2)
        : "0.00"

    csvContent += `Total Followers,${insightsData.totalFollowers},Current audience size\n`
    csvContent += `Impressions,${insightsData.impressions},Content views\n`
    csvContent += `Engagement Rate,${engagementRate}%,Industry avg: 1-2%\n`
    csvContent += `Clicks,${insightsData.clicks},Link clicks\n`
  }

  // Secondary Metrics
  csvContent += "\n=== SECONDARY METRICS ===\n"
  csvContent += "Metric,Value\n"
  if (insightsData) {
    csvContent += `Page Views,${insightsData.pageViews}\n`
    csvContent += `Unique Visitors,${insightsData.uniquePageViews}\n`
    csvContent += `Reactions,${insightsData.reactions}\n`
    csvContent += `Comments,${insightsData.comments}\n`
    csvContent += `Shares,${insightsData.shares}\n`
    csvContent += `New Followers,${insightsData.followerGains}\n`
  }

  // Top Posts
  if (postsData.length > 0) {
    csvContent += "\n=== TOP POSTS ===\n"
    csvContent += "Content,Impressions,Reactions,Comments,Shares,Engagement Rate,Date\n"
    postsData.slice(0, 10).forEach((post) => {
      const content = (post.commentary || "")
        .substring(0, 50)
        .replace(/"/g, '""')
        .replace(/\n/g, " ")
      csvContent += `"${content}",${post.insights?.impressions || 0},${
        post.insights?.likes || 0
      },${post.insights?.comments || 0},${post.insights?.shares || 0},${(
        post.insights?.engagementRate || 0
      ).toFixed(2)}%,${new Date(post.createdAt).toLocaleDateString()}\n`
    })
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Download LinkedIn analytics as PNG
function downloadLinkedInPNG(
  dateRange: LinkedInTimeRange,
  organizationData: LinkedInOrganization | null,
  insightsData: LinkedInOrganizationInsights | null,
  postsData: LinkedInPostWithInsights[]
) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    alert("Unable to create canvas. Please try again.")
    return
  }

  canvas.width = 1200
  canvas.height = 800

  // Background
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // LinkedIn blue gradient accent bar
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
  gradient.addColorStop(0, "#0077B5")
  gradient.addColorStop(1, "#00A0DC")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, 6)

  // Header
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 36px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(`${organizationData?.name || "LinkedIn"} Analytics`, 60, 70)

  ctx.fillStyle = "#9ca3af"
  ctx.font = "16px system-ui, -apple-system, sans-serif"
  ctx.fillText(`linkedin.com/company/${organizationData?.vanityName || ""}`, 60, 100)

  ctx.fillStyle = "#9ca3af"
  ctx.font = "18px system-ui, -apple-system, sans-serif"
  ctx.fillText(
    `Period: Last ${
      dateRange === "7d"
        ? "7 days"
        : dateRange === "30d"
        ? "30 days"
        : dateRange === "90d"
        ? "90 days"
        : "12 months"
    }`,
    60,
    130
  )

  ctx.fillStyle = "#6b7280"
  ctx.font = "14px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, canvas.width - 60, 70)

  // Divider
  ctx.strokeStyle = "#374151"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(60, 160)
  ctx.lineTo(canvas.width - 60, 160)
  ctx.stroke()

  // Calculate metrics
  const engagementRate =
    insightsData && insightsData.impressions > 0
      ? ((insightsData.totalEngagements / insightsData.impressions) * 100).toFixed(2)
      : "0.00"

  // Primary KPIs section
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("KEY METRICS", 60, 200)

  const primaryMetrics = insightsData
    ? [
        {
          label: "Total Followers",
          value: formatNumber(insightsData.totalFollowers),
          trend: `+${formatNumber(insightsData.netFollowerChange)}`,
          trendColor: insightsData.netFollowerChange >= 0 ? "#22c55e" : "#ef4444",
        },
        {
          label: "Impressions",
          value: formatNumber(insightsData.impressions),
          trend: "Content views",
          trendColor: "#0077B5",
        },
        {
          label: "Engagement Rate",
          value: `${engagementRate}%`,
          trend: parseFloat(engagementRate) >= 2 ? "Above avg" : "Average",
          trendColor: parseFloat(engagementRate) >= 2 ? "#22c55e" : "#eab308",
        },
        {
          label: "Clicks",
          value: formatNumber(insightsData.clicks),
          trend: "Link clicks",
          trendColor: "#0077B5",
        },
      ]
    : []

  const cardWidth = 250
  const cardHeight = 100
  const startX = 60
  const startY = 220
  const gapX = 30

  primaryMetrics.forEach((metric, index) => {
    const x = startX + index * (cardWidth + gapX)
    const y = startY

    // Card background
    const cardGradient = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight)
    cardGradient.addColorStop(0, "#1f2937")
    cardGradient.addColorStop(1, "#111827")
    ctx.fillStyle = cardGradient
    ctx.beginPath()
    ctx.roundRect(x, y, cardWidth, cardHeight, 12)
    ctx.fill()

    // Border
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = "#9ca3af"
    ctx.font = "11px system-ui, -apple-system, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(metric.label.toUpperCase(), x + 20, y + 25)

    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif"
    ctx.fillText(metric.value, x + 20, y + 60)

    ctx.fillStyle = metric.trendColor
    ctx.font = "12px system-ui, -apple-system, sans-serif"
    ctx.fillText(metric.trend, x + 20, y + 85)
  })

  // Footer
  ctx.fillStyle = "#6b7280"
  ctx.font = "12px system-ui, -apple-system, sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Powered by LinkedIn Marketing API • 434 Media", canvas.width / 2, canvas.height - 40)

  // Bottom gradient
  const bottomGradient = ctx.createLinearGradient(0, canvas.height - 6, canvas.width, canvas.height - 6)
  bottomGradient.addColorStop(0, "#0077B5")
  bottomGradient.addColorStop(1, "#00A0DC")
  ctx.fillStyle = bottomGradient
  ctx.fillRect(0, canvas.height - 6, canvas.width, 6)

  // Download
  const today = new Date().toISOString().split("T")[0]
  const link = document.createElement("a")
  link.download = `${organizationData?.vanityName || "linkedin"}-analytics-${dateRange}-${today}.png`
  link.href = canvas.toDataURL("image/png")
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function LinkedInAnalyticsClientPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<LinkedInTimeRange>("30d")

  // Data states
  const [insightsData, setInsightsData] = useState<LinkedInOrganizationInsights | null>(null)
  const [organizationData, setOrganizationData] = useState<LinkedInOrganization | null>(null)
  const [postsData, setPostsData] = useState<LinkedInPostWithInsights[]>([])
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean
    message?: string
    organization?: any
  } | null>(null)

  // Load LinkedIn data on component mount and when date range changes
  useEffect(() => {
    loadLinkedInData()
  }, [dateRange])

  const loadLinkedInData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Test connection first
      const connectionResponse = await fetch("/api/linkedin?endpoint=test-connection")
      if (!connectionResponse.ok) {
        if (connectionResponse.status === 401) {
          window.location.href = "/admin"
          return
        }
        let errorMessage = "Failed to connect to LinkedIn API"
        try {
          const errJson = await connectionResponse.json()
          errorMessage = errJson?.details || errJson?.error || errorMessage
          if (errJson?.missingVariables?.length) {
            errorMessage += `. Missing: ${errJson.missingVariables.join(", ")}`
          }
        } catch {
          // JSON parsing failed, use default message
        }
        throw new Error(errorMessage)
      }
      const connectionData = await connectionResponse.json()
      setConnectionStatus(connectionData)

      // Fetch data in parallel
      const [orgRes, insightsRes, postsRes] = await Promise.all([
        fetch("/api/linkedin?endpoint=organization-info").catch(() => null),
        fetch(`/api/linkedin?endpoint=insights&range=${dateRange}`).catch(() => null),
        fetch("/api/linkedin?endpoint=posts").catch(() => null),
      ])

      // Process organization data
      if (orgRes?.ok) {
        try {
          const orgResult = await orgRes.json()
          if (orgResult.data) {
            setOrganizationData(orgResult.data)
          }
        } catch {
          console.warn("Failed to parse organization data")
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

      // Process posts data
      if (postsRes?.ok) {
        try {
          const postsResult = await postsRes.json()
          if (postsResult.data) {
            setPostsData(postsResult.data)
          }
        } catch {
          console.warn("Failed to parse posts data")
        }
      }
    } catch (err) {
      console.error("Error loading LinkedIn data:", err)
      setError(err instanceof Error ? err.message : "Failed to load LinkedIn data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadLinkedInData()
  }

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    window.location.href = "/admin"
  }

  const handleDownloadCSV = () => {
    downloadLinkedInCSV(dateRange, organizationData, insightsData, postsData)
  }

  const handleDownloadPNG = () => {
    downloadLinkedInPNG(dateRange, organizationData, insightsData, postsData)
  }

  return (
    <div className="bg-neutral-50 w-full overflow-x-hidden py-16">
      {/* LinkedIn Header */}
      <div className="w-full overflow-x-hidden">
        <LinkedInAnalyticsHeader
          onRefresh={handleRefresh}
          onLogout={handleLogout}
          isLoading={isLoading}
          organizationData={organizationData}
          connectionStatus={connectionStatus}
          selectedRange={dateRange}
          onRangeChange={setDateRange}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPNG={handleDownloadPNG}
        />
      </div>

      <div className="py-4 sm:py-6 w-full overflow-x-hidden">
        <div className="px-3 sm:px-4 lg:px-6 w-full overflow-x-hidden">
          {/* Error Display */}
          {error && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-600">Error</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Organization Info */}
          {!isLoading && organizationData && (
            <div className="mb-10 sm:mb-12">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                <h2 className="text-sm sm:text-lg font-semibold text-neutral-900">Organization Overview</h2>
                <InfoTooltip content="Your LinkedIn Company Page information including follower count and company details." />
              </div>
              <LinkedInOrganizationInfo organization={organizationData} />
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-[#0077B5] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-neutral-500 text-sm">Loading LinkedIn analytics...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                  <h2 className="text-sm sm:text-lg font-semibold text-neutral-900">Key Metrics</h2>
                  <InfoTooltip content="Core performance indicators: followers, impressions, engagement rate, and click-through performance." />
                </div>
                <LinkedInKeyMetrics
                  insights={insightsData}
                  dateRange={dateRange}
                  connectionStatus={connectionStatus}
                />
              </div>

              {/* Top Posts */}
              <div className="mb-10 sm:mb-12">
                <div className="flex items-center gap-2 mb-3 sm:mb-4 pt-2">
                  <h2 className="text-sm sm:text-lg font-semibold text-neutral-900">Top Performing Posts</h2>
                  <InfoTooltip content="Your most engaging LinkedIn posts ranked by impressions, reactions, and engagement rate." />
                </div>
                <LinkedInTopPostsTable posts={postsData} connectionStatus={connectionStatus} />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="text-center text-neutral-400 text-sm pt-8 pb-4">
            <p>
              Powered by LinkedIn Marketing API <span className="hidden md:inline">•</span>{" "}
              <span className="block md:inline">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

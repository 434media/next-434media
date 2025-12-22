"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MailchimpHeader } from "../../components/mailchimp/MailchimpHeader"
import { MailchimpMetricsOverview } from "../../components/mailchimp/MailchimpMetricsOverview"
import { MailchimpTopCampaignsTable } from "../../components/mailchimp/MailchimpTopCampaignsTable"
import { MailchimpTagsOverview } from "../../components/mailchimp/MailchimpTagsOverview"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { useToast } from "../../hooks/use-toast"
import type {
  MailchimpAnalyticsSummary,
  MailchimpCampaignPerformanceResponse,
  MailchimpSubscriberGrowthResponse,
  MailchimpEngagementResponse,
  MailchimpGeographicResponse,
  MailchimpListsResponse,
  MailchimpCampaignsResponse,
  MailchimpRealtimeData,
  MailchimpTag,
  MailchimpTagsResponse,
} from "../../types/mailchimp-analytics"

interface MailchimpAnalyticsData {
  summary?: MailchimpAnalyticsSummary
  campaigns?: MailchimpCampaignPerformanceResponse
  subscribers?: MailchimpSubscriberGrowthResponse
  engagement?: MailchimpEngagementResponse
  geographic?: MailchimpGeographicResponse
  lists?: MailchimpListsResponse
  allCampaigns?: MailchimpCampaignsResponse
  realtime?: MailchimpRealtimeData
  tags?: MailchimpTagsResponse
}

export default function MailchimpAnalyticsClientPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<MailchimpAnalyticsData>({})
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days ago
    endDate: new Date().toISOString().split("T")[0], // today
  })
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("")
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [configStatus, setConfigStatus] = useState<any>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Check configuration on component mount
  useEffect(() => {
    fetchConfig()
  }, [])

  // Fetch data when date range changes
  useEffect(() => {
    fetchAllData()
  }, [dateRange, selectedAudienceId])

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/mailchimp/config-check")
      const result = await response.json()
      setConfigStatus(result)

      if (!result.configured) {
        toast({
          title: "Configuration Required",
          description: "Mailchimp API credentials are not properly configured.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch configuration:", error)
      toast({
        title: "Configuration Error",
        description: "Failed to check Mailchimp configuration.",
        variant: "destructive",
      })
    }
  }

  const fetchData = async (endpoint: string, requiresDateRange = true) => {
    const params = new URLSearchParams({ endpoint })

    if (requiresDateRange) {
      params.append("startDate", dateRange.startDate)
      params.append("endDate", dateRange.endDate)
    }

    if (selectedAudienceId && selectedAudienceId !== "all") {
      params.append("audienceId", selectedAudienceId)
    }

    const response = await fetch(`/api/mailchimp?${params}`)
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || `Failed to fetch ${endpoint} data`)
    }

    return result.data
  }

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      const [summary, campaigns, subscribers, engagement, geographic, lists, allCampaigns, realtime, tags] =
        await Promise.all([
          fetchData("summary"),
          fetchData("campaigns"),
          fetchData("subscribers"),
          fetchData("engagement"),
          fetchData("geographic", false),
          fetchData("lists", false),
          fetchData("all-campaigns"),
          fetchData("realtime", false),
          fetchData("tags", false),
        ])

      setData({
        summary,
        campaigns,
        subscribers,
        engagement,
        geographic,
        lists,
        allCampaigns,
        realtime,
        tags,
      })

      toast({
        title: "Data Updated",
        description: "Mailchimp analytics data has been refreshed successfully.",
      })
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Data Fetch Error",
        description: error instanceof Error ? error.message : "Failed to fetch analytics data.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateRangeChange = (newRange: { startDate: string; endDate: string }) => {
    setDateRange(newRange)
  }

  const handleAudienceChange = (audienceId: string) => {
    setSelectedAudienceId(audienceId)
  }

  const handleTagChange = (tagId: string) => {
    setSelectedTag(tagId)
    // When a tag is selected, we could filter campaigns in the future
  }

  // Download CSV function
  const handleDownloadCSV = useCallback(() => {
    if (!data.summary) {
      toast({
        title: "No Data",
        description: "No data available to export.",
        variant: "destructive",
      })
      return
    }

    const audienceName = data.summary.listName || "434 Media"
    const dateRangeStr = `${dateRange.startDate}_to_${dateRange.endDate}`
    
    // Build CSV content with comprehensive metrics
    let csvContent = "=== MAILCHIMP ANALYTICS REPORT ===\n\n"
    csvContent += "REPORT DETAILS\n"
    csvContent += "Metric,Value\n"
    csvContent += `Audience,${audienceName}\n`
    csvContent += `Date Range,${dateRange.startDate} to ${dateRange.endDate}\n`
    csvContent += `Generated,${new Date().toLocaleString()}\n\n`
    
    // Metrics Overview Section
    csvContent += "METRICS OVERVIEW\n"
    csvContent += "Metric,Value\n"
    csvContent += `Total Subscribers,${data.summary.totalSubscribers.toLocaleString()}\n`
    csvContent += `Total Campaigns,${data.summary.totalCampaigns}\n`
    csvContent += `Emails Sent,${data.summary.totalEmailsSent.toLocaleString()}\n`
    csvContent += `Total Opens,${data.summary.totalOpens.toLocaleString()}\n`
    csvContent += `Total Clicks,${data.summary.totalClicks.toLocaleString()}\n`
    csvContent += `Average Open Rate,${data.summary.averageOpenRate.toFixed(2)}%\n`
    csvContent += `Average Click Rate,${data.summary.averageClickRate.toFixed(2)}%\n`
    csvContent += `Unsubscribe Rate,${data.summary.unsubscribeRate.toFixed(2)}%\n`
    csvContent += `Bounce Rate,${data.summary.averageBounceRate.toFixed(2)}%\n\n`
    
    // Calculate additional metrics from campaign data
    if (data.allCampaigns?.data && data.allCampaigns.data.length > 0) {
      const campaigns = data.allCampaigns.data
      const totalBounces = campaigns.reduce((sum, c) => sum + (c.report_summary?.bounces || 0), 0)
      const totalUnsubscribes = campaigns.reduce((sum, c) => sum + (c.report_summary?.unsubscribed || 0), 0)
      const totalForwards = campaigns.reduce((sum, c) => sum + (c.report_summary?.forwards || 0), 0)
      
      csvContent += "ENGAGEMENT SUMMARY\n"
      csvContent += "Metric,Value\n"
      csvContent += `Total Bounces,${totalBounces.toLocaleString()}\n`
      csvContent += `Total Unsubscribes,${totalUnsubscribes.toLocaleString()}\n`
      csvContent += `Total Forwards,${totalForwards.toLocaleString()}\n\n`
      
      // Sort campaigns by date (latest first) and add to CSV
      const sortedCampaigns = [...campaigns].sort(
        (a, b) => new Date(b.send_time).getTime() - new Date(a.send_time).getTime()
      )
      
      csvContent += "RECENT CAMPAIGNS\n"
      csvContent += "Campaign Title,Subject Line,Send Date,Recipients,Emails Sent,Opens,Unique Opens,Open Rate,Clicks,Unique Clicks,Click Rate,Bounces,Unsubscribes,Forwards\n"
      
      for (const campaign of sortedCampaigns) {
        const sendDate = new Date(campaign.send_time).toLocaleDateString()
        const title = (campaign.settings?.title || 'Untitled').replace(/"/g, '""')
        const subject = (campaign.settings?.subject_line || '').replace(/"/g, '""')
        csvContent += `"${title}","${subject}",${sendDate},${campaign.recipients?.recipient_count || 0},${campaign.report_summary?.emails_sent || 0},${campaign.report_summary?.opens || 0},${campaign.report_summary?.unique_opens || 0},${((campaign.report_summary?.open_rate || 0) * 100).toFixed(2)}%,${campaign.report_summary?.clicks || 0},${campaign.report_summary?.subscriber_clicks || 0},${((campaign.report_summary?.click_rate || 0) * 100).toFixed(2)}%,${campaign.report_summary?.bounces || 0},${campaign.report_summary?.unsubscribed || 0},${campaign.report_summary?.forwards || 0}\n`
      }
    }

    // Download file with date range in filename
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `mailchimp-analytics_${audienceName.replace(/\s+/g, "-").toLowerCase()}_${dateRangeStr}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    toast({
      title: "CSV Downloaded",
      description: `Complete analytics report for ${audienceName} exported successfully.`,
    })
  }, [data, dateRange, toast])

  // Download PNG function using Canvas API - includes metrics overview and campaigns
  const handleDownloadPNG = useCallback(async () => {
    if (!contentRef.current || !data.summary) {
      toast({
        title: "No Data",
        description: "No data available to export.",
        variant: "destructive",
      })
      return
    }

    const audienceName = data.summary.listName || "434 Media"
    
    // Format dates as "Month Day, Year"
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr + 'T00:00:00')
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
    
    // Determine the date range label based on the selected range
    const getDateRangeLabel = () => {
      const start = new Date(dateRange.startDate)
      const end = new Date(dateRange.endDate)
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      // Check if end date is today
      const today = new Date()
      const isEndToday = end.toDateString() === today.toDateString()
      
      if (isEndToday) {
        if (diffDays === 0) return "Today"
        if (diffDays === 7) return "Last 7 Days"
        if (diffDays === 30) return "Last 30 Days"
        if (diffDays === 90) return "Last 90 Days"
      }
      
      return `${formatDate(dateRange.startDate)} – ${formatDate(dateRange.endDate)}`
    }
    
    const dateRangeLabel = getDateRangeLabel()
    const dateRangeFormatted = `${formatDate(dateRange.startDate)} – ${formatDate(dateRange.endDate)}`
    
    const campaigns = data.allCampaigns?.data || []
    const sortedCampaigns = [...campaigns]
      .sort((a, b) => new Date(b.send_time).getTime() - new Date(a.send_time).getTime())
      .slice(0, 10) // Top 10 campaigns

    try {
      // Create canvas - dynamic height based on content
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Could not get canvas context")

      // Calculate dimensions
      const width = 1400
      const headerHeight = 120
      const metricsHeight = 280
      const campaignsHeaderHeight = 60
      const campaignRowHeight = 36
      const campaignsHeight = campaignsHeaderHeight + (sortedCampaigns.length * campaignRowHeight) + 40
      const footerHeight = 60
      const height = headerHeight + metricsHeight + campaignsHeight + footerHeight

      canvas.width = width
      canvas.height = height

      // Draw background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)

      // Draw header background
      ctx.fillStyle = "#0a0a0a"
      ctx.fillRect(0, 0, width, headerHeight)

      // Draw header text
      ctx.fillStyle = "#FFE01B"
      ctx.font = "bold 28px system-ui, -apple-system, sans-serif"
      ctx.fillText(`${audienceName} - Mailchimp Analytics`, 40, 50)

      // Show date range label (e.g., "Last 30 Days") and formatted dates
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 16px system-ui, -apple-system, sans-serif"
      ctx.fillText(dateRangeLabel, 40, 80)
      
      ctx.fillStyle = "#a0a0a0"
      ctx.font = "14px system-ui, -apple-system, sans-serif"
      // Only show formatted dates if the label is a preset (to avoid duplication)
      if (dateRangeLabel !== dateRangeFormatted) {
        ctx.fillText(dateRangeFormatted, 40, 100)
      }
      
      ctx.fillStyle = "#666666"
      ctx.font = "12px system-ui, -apple-system, sans-serif"
      ctx.fillText(`Generated: ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, width - 350, 80)

      // Calculate metrics from campaign data for accuracy
      const totalRecipients = campaigns.reduce((sum, c) => sum + (c.recipients?.recipient_count || 0), 0)
      const totalOpens = campaigns.reduce((sum, c) => sum + (c.report_summary?.opens || 0), 0)
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.report_summary?.clicks || 0), 0)
      const totalBounces = campaigns.reduce((sum, c) => sum + (c.report_summary?.bounces || 0), 0)
      const totalUnsubscribes = campaigns.reduce((sum, c) => sum + (c.report_summary?.unsubscribed || 0), 0)
      const avgOpenRate = campaigns.length > 0
        ? (campaigns.reduce((sum, c) => sum + (c.report_summary?.open_rate || 0), 0) / campaigns.length) * 100
        : 0
      const avgClickRate = campaigns.length > 0
        ? (campaigns.reduce((sum, c) => sum + (c.report_summary?.click_rate || 0), 0) / campaigns.length) * 100
        : 0
      const bounceRate = totalRecipients > 0 ? (totalBounces / totalRecipients) * 100 : 0
      const unsubscribeRate = totalRecipients > 0 ? (totalUnsubscribes / totalRecipients) * 100 : 0

      // Metrics section
      const metricsStartY = headerHeight + 20
      
      ctx.fillStyle = "#0a0a0a"
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif"
      ctx.fillText("METRICS OVERVIEW", 40, metricsStartY + 20)

      const metrics = [
        { label: "Subscribers", value: data.summary.totalSubscribers.toLocaleString(), color: "#FFE01B" },
        { label: "Campaigns", value: campaigns.length.toString(), color: "#22c55e" },
        { label: "Emails Sent", value: totalRecipients.toLocaleString(), color: "#3b82f6" },
        { label: "Total Opens", value: totalOpens.toLocaleString(), color: "#a855f7" },
        { label: "Total Clicks", value: totalClicks.toLocaleString(), color: "#f97316" },
        { label: "Open Rate", value: `${avgOpenRate.toFixed(1)}%`, color: "#22c55e" },
        { label: "Click Rate", value: `${avgClickRate.toFixed(1)}%`, color: "#3b82f6" },
        { label: "Bounce Rate", value: `${bounceRate.toFixed(2)}%`, color: "#ef4444" },
        { label: "Unsubscribe Rate", value: `${unsubscribeRate.toFixed(2)}%`, color: "#f97316" },
        { label: "Bounces", value: totalBounces.toLocaleString(), color: "#ef4444" },
      ]

      const cardWidth = 240
      const cardHeight = 80
      const cardsPerRow = 5
      const cardGap = 25
      const startX = 40
      const startY = metricsStartY + 40

      metrics.forEach((metric, index) => {
        const row = Math.floor(index / cardsPerRow)
        const col = index % cardsPerRow
        const x = startX + col * (cardWidth + cardGap)
        const y = startY + row * (cardHeight + cardGap)

        // Card background
        ctx.fillStyle = "#f9f9f9"
        ctx.fillRect(x, y, cardWidth, cardHeight)

        // Card left accent
        ctx.fillStyle = metric.color
        ctx.fillRect(x, y, 4, cardHeight)

        // Metric label
        ctx.fillStyle = "#666666"
        ctx.font = "13px system-ui, -apple-system, sans-serif"
        ctx.fillText(metric.label, x + 16, y + 28)

        // Metric value
        ctx.fillStyle = "#0a0a0a"
        ctx.font = "bold 24px system-ui, -apple-system, sans-serif"
        ctx.fillText(metric.value, x + 16, y + 58)
      })

      // Campaigns section
      const campaignsStartY = metricsStartY + metricsHeight
      
      ctx.fillStyle = "#0a0a0a"
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif"
      ctx.fillText("RECENT CAMPAIGNS", 40, campaignsStartY + 20)

      // Table header
      const tableY = campaignsStartY + 40
      ctx.fillStyle = "#f3f4f6"
      ctx.fillRect(40, tableY, width - 80, 32)

      ctx.fillStyle = "#374151"
      ctx.font = "bold 12px system-ui, -apple-system, sans-serif"
      ctx.fillText("CAMPAIGN", 55, tableY + 21)
      ctx.fillText("DATE", 450, tableY + 21)
      ctx.fillText("SENT", 550, tableY + 21)
      ctx.fillText("OPENS", 650, tableY + 21)
      ctx.fillText("CLICKS", 750, tableY + 21)
      ctx.fillText("OPEN %", 850, tableY + 21)
      ctx.fillText("CLICK %", 950, tableY + 21)
      ctx.fillText("BOUNCES", 1050, tableY + 21)
      ctx.fillText("UNSUBS", 1150, tableY + 21)
      ctx.fillText("PERF", 1250, tableY + 21)

      // Table rows
      sortedCampaigns.forEach((campaign, index) => {
        const rowY = tableY + 32 + (index * campaignRowHeight)
        const openRate = (campaign.report_summary?.open_rate || 0) * 100
        const clickRate = (campaign.report_summary?.click_rate || 0) * 100

        // Alternating row background
        if (index % 2 === 1) {
          ctx.fillStyle = "#fafafa"
          ctx.fillRect(40, rowY, width - 80, campaignRowHeight)
        }

        // Row border
        ctx.strokeStyle = "#e5e7eb"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(40, rowY + campaignRowHeight)
        ctx.lineTo(width - 40, rowY + campaignRowHeight)
        ctx.stroke()

        // Performance indicator
        let perfColor = "#ef4444"
        let perfLabel = "Poor"
        if (openRate >= 25) { perfColor = "#22c55e"; perfLabel = "Excellent" }
        else if (openRate >= 20) { perfColor = "#3b82f6"; perfLabel = "Good" }
        else if (openRate >= 15) { perfColor = "#f59e0b"; perfLabel = "Average" }

        // Campaign title (truncated)
        const title = campaign.settings?.title || "Untitled"
        const truncatedTitle = title.length > 45 ? title.substring(0, 42) + "..." : title
        ctx.fillStyle = "#0a0a0a"
        ctx.font = "13px system-ui, -apple-system, sans-serif"
        ctx.fillText(truncatedTitle, 55, rowY + 23)

        // Date
        const date = new Date(campaign.send_time)
        ctx.fillStyle = "#6b7280"
        ctx.font = "12px system-ui, -apple-system, sans-serif"
        ctx.fillText(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 450, rowY + 23)

        // Stats
        ctx.fillStyle = "#0a0a0a"
        ctx.font = "12px system-ui, -apple-system, sans-serif"
        ctx.fillText((campaign.recipients?.recipient_count || 0).toLocaleString(), 550, rowY + 23)
        ctx.fillText((campaign.report_summary?.opens || 0).toLocaleString(), 650, rowY + 23)
        ctx.fillText((campaign.report_summary?.clicks || 0).toLocaleString(), 750, rowY + 23)
        
        // Rates with color
        ctx.fillStyle = openRate >= 20 ? "#22c55e" : openRate >= 15 ? "#f59e0b" : "#6b7280"
        ctx.font = "bold 12px system-ui, -apple-system, sans-serif"
        ctx.fillText(`${openRate.toFixed(1)}%`, 850, rowY + 23)
        
        ctx.fillStyle = clickRate >= 3 ? "#22c55e" : clickRate >= 2 ? "#f59e0b" : "#6b7280"
        ctx.fillText(`${clickRate.toFixed(1)}%`, 950, rowY + 23)

        // Bounces and unsubs
        ctx.fillStyle = "#6b7280"
        ctx.font = "12px system-ui, -apple-system, sans-serif"
        ctx.fillText((campaign.report_summary?.bounces || 0).toString(), 1050, rowY + 23)
        ctx.fillText((campaign.report_summary?.unsubscribed || 0).toString(), 1150, rowY + 23)

        // Performance badge
        ctx.fillStyle = perfColor
        ctx.font = "bold 11px system-ui, -apple-system, sans-serif"
        ctx.fillText(perfLabel, 1250, rowY + 23)
      })

      // Footer
      const footerY = height - footerHeight
      ctx.fillStyle = "#f9f9f9"
      ctx.fillRect(0, footerY, width, footerHeight)

      ctx.fillStyle = "#9ca3af"
      ctx.font = "12px system-ui, -apple-system, sans-serif"
      ctx.fillText("434 Media • Mailchimp Analytics Dashboard", 40, footerY + 35)
      ctx.fillText(`${campaigns.length} campaigns • ${data.summary.totalSubscribers.toLocaleString()} subscribers`, width - 300, footerY + 35)

      // Download with date range in filename
      const link = document.createElement("a")
      link.download = `mailchimp-analytics_${audienceName.replace(/\s+/g, "-").toLowerCase()}_${dateRange.startDate}_to_${dateRange.endDate}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()

      toast({
        title: "PNG Downloaded",
        description: `Complete analytics report for ${audienceName} exported successfully.`,
      })
    } catch (error) {
      console.error("PNG generation error:", error)
      toast({
        title: "Export Failed",
        description: "Failed to generate PNG. Please try again.",
        variant: "destructive",
      })
    }
  }, [data, dateRange, toast])

  if (!configStatus?.configured) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="bg-white border-neutral-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-neutral-900">
                Mailchimp Configuration Required
                <Badge variant="destructive">Not Configured</Badge>
              </CardTitle>
              <CardDescription className="text-neutral-600">
                Mailchimp API credentials need to be configured before accessing analytics data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-neutral-900">Missing Configuration:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600">
                    {configStatus?.validation?.missingVariables?.map((variable: string) => (
                      <li key={variable}>{variable}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-neutral-900">Required Environment Variables:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-neutral-600">
                    <li>MAILCHIMP_API_KEY</li>
                    <li>MAILCHIMP_AUDIENCE_ID_434MEDIA (or MAILCHIMP_AUDIENCE_ID_TXMX)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-white pt-16">
      {/* Header - with padding to clear fixed navbar */}
      <div className="border-b border-neutral-100">
        <MailchimpHeader
          isLoading={isLoading}
          onRefresh={fetchAllData}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          audienceName={data.summary?.listName || "434 Media"}
          audienceId={selectedAudienceId}
          memberCount={data.summary?.totalSubscribers || 0}
          onDownloadCSV={handleDownloadCSV}
          onDownloadPNG={handleDownloadPNG}
        />
      </div>

      {/* Main Content */}
      <div ref={contentRef} className="container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        {/* Metrics Overview */}
        {data.summary && (
          <MailchimpMetricsOverview
            data={data.summary}
            campaignData={data.allCampaigns?.data || []}
            geographicData={data.geographic?.data || []}
            allAudiences={data.lists?.data || []}
            selectedAudienceId={selectedAudienceId}
          />
        )}

        {/* Tags Section - Full Width */}
        <div>
          <MailchimpTagsOverview
            tags={data.tags?.tags || []}
            selectedTag={selectedTag}
            onTagSelect={handleTagChange}
            totalSubscribers={data.summary?.totalSubscribers || 0}
          />
        </div>

        {/* Recent Campaigns - Full Width */}
        <div>
          {data.allCampaigns && <MailchimpTopCampaignsTable data={data.allCampaigns} />}
        </div>
      </div>
    </div>
  )
}

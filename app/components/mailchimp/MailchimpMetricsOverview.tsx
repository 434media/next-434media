"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../analytics/Card"
import { Badge } from "../analytics/Badge"
import { TrendingUp, Mail, Users, MousePointer, UserMinus, AlertTriangle, BarChart3, Eye, Globe } from 'lucide-react'
import type { MailchimpAnalyticsSummary } from "../../types/mailchimp-analytics"

interface MailchimpMetricsOverviewProps {
  data: MailchimpAnalyticsSummary
  campaignData?: Array<{
    id: string
    settings: {
      subject_line: string
      title: string
    }
    recipients: {
      recipient_count: number
    }
    report_summary: {
      opens: number
      unique_opens: number
      open_rate: number
      clicks: number
      subscriber_clicks: number
      click_rate: number
      emails_sent: number
      unsubscribed: number
      bounces: number
      forwards: number
      forward_opens: number
      ecommerce: {
        total_orders: number
        total_spent: number
        total_revenue: number
      }
    }
    send_time: string
  }>
  geographicData?: Array<{
    country: string
    subscribers: number
    percentage: number
    opens: number
    clicks: number
    openRate: number
    clickRate: number
  }>
  allAudiences?: Array<{
    id: string
    name: string
    stats: {
      member_count: number
      campaign_count: number
    }
  }>
  selectedAudienceId?: string
}

function getPerformanceBadge(value: number, type: "open_rate" | "click_rate" | "unsubscribe_rate" | "bounce_rate") {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default"
  let label = ""

  switch (type) {
    case "open_rate":
      if (value >= 25) {
        variant = "default"
        label = "Excellent"
      } else if (value >= 20) {
        variant = "secondary"
        label = "Good"
      } else if (value >= 15) {
        variant = "outline"
        label = "Average"
      } else {
        variant = "destructive"
        label = "Poor"
      }
      break
    case "click_rate":
      if (value >= 3) {
        variant = "default"
        label = "Excellent"
      } else if (value >= 2) {
        variant = "secondary"
        label = "Good"
      } else if (value >= 1) {
        variant = "outline"
        label = "Average"
      } else {
        variant = "destructive"
        label = "Poor"
      }
      break
    case "unsubscribe_rate":
      if (value <= 0.5) {
        variant = "default"
        label = "Excellent"
      } else if (value <= 1) {
        variant = "secondary"
        label = "Good"
      } else if (value <= 2) {
        variant = "outline"
        label = "Average"
      } else {
        variant = "destructive"
        label = "High"
      }
      break
    case "bounce_rate":
      if (value <= 2) {
        variant = "default"
        label = "Excellent"
      } else if (value <= 5) {
        variant = "secondary"
        label = "Good"
      } else if (value <= 10) {
        variant = "outline"
        label = "Average"
      } else {
        variant = "destructive"
        label = "High"
      }
      break
  }

  return <Badge variant={variant}>{label}</Badge>
}

// Helper function to safely get numeric value
function safeNumber(value: any): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

// Helper function to format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

export function MailchimpMetricsOverview({ 
  data, 
  campaignData = [], 
  geographicData = [], 
  allAudiences = [],
  selectedAudienceId 
}: MailchimpMetricsOverviewProps) {
  console.log('MailchimpMetricsOverview - campaignData:', campaignData)
  console.log('MailchimpMetricsOverview - geographicData:', geographicData)
  console.log('MailchimpMetricsOverview - allAudiences:', allAudiences)
  console.log('MailchimpMetricsOverview - selectedAudienceId:', selectedAudienceId)

  // Calculate total subscribers and campaigns based on selection
  let totalSubscribers = 0
  let totalCampaigns = 0
  let audienceDescription = ""

  if (selectedAudienceId && selectedAudienceId !== "all") {
    // Show data for selected audience
    const selectedAudience = allAudiences.find(audience => audience.id === selectedAudienceId)
    if (selectedAudience) {
      totalSubscribers = selectedAudience.stats.member_count
      totalCampaigns = data.campaignCount // Use campaign count from the filtered data
      audienceDescription = `Active subscribers in ${selectedAudience.name}`
    } else {
      // Fallback to data from summary
      totalSubscribers = data.totalSubscribers
      totalCampaigns = data.campaignCount
      audienceDescription = `Active subscribers in ${data.listName}`
    }
  } else {
    // Show combined data for all audiences
    totalSubscribers = allAudiences.reduce((sum, audience) => sum + audience.stats.member_count, 0)
    totalCampaigns = campaignData.length // Use actual campaign count from filtered data
    audienceDescription = `Active subscribers across all audiences`
  }

  // Validate and filter campaign data
  const validCampaigns = campaignData.filter(campaign => 
    campaign && 
    campaign.report_summary && 
    typeof campaign.report_summary === 'object'
  )

  console.log('Valid campaigns:', validCampaigns.length, 'out of', campaignData.length)

  // Log bounce and unsubscribe data for debugging
  validCampaigns.forEach((campaign, index) => {
    if (index < 3) { // Log first 3 campaigns for debugging
      console.log(`Campaign ${campaign.id} bounce/unsubscribe data:`, {
        bounces: campaign.report_summary?.bounces,
        unsubscribed: campaign.report_summary?.unsubscribed,
        emails_sent: campaign.report_summary?.emails_sent,
        recipient_count: campaign.recipients?.recipient_count,
      })
    }
  })

  // Calculate metrics from campaign data with safe number conversion
  // Use recipients.recipient_count as the primary source, fallback to report_summary.emails_sent
  const totalRecipients = validCampaigns.reduce((sum, campaign) => {
    const recipientCount = safeNumber(campaign.recipients?.recipient_count)
    const emailsSent = safeNumber(campaign.report_summary?.emails_sent)
    
    // Prefer recipient_count over emails_sent
    const actualRecipients = recipientCount > 0 ? recipientCount : emailsSent
    
    console.log(`Campaign ${campaign.id}: recipient_count = ${campaign.recipients?.recipient_count}, emails_sent = ${campaign.report_summary?.emails_sent}, using = ${actualRecipients}`)
    return sum + actualRecipients
  }, 0)

  const totalOpens = validCampaigns.reduce((sum, campaign) => {
    return sum + safeNumber(campaign.report_summary?.opens)
  }, 0)

  const totalClicks = validCampaigns.reduce((sum, campaign) => {
    return sum + safeNumber(campaign.report_summary?.clicks)
  }, 0)

  const totalUnsubscribes = validCampaigns.reduce((sum, campaign) => {
    const unsubscribes = safeNumber(campaign.report_summary?.unsubscribed)
    console.log(`Campaign ${campaign.id} unsubscribes: ${campaign.report_summary?.unsubscribed} -> ${unsubscribes}`)
    return sum + unsubscribes
  }, 0)

  const totalBounces = validCampaigns.reduce((sum, campaign) => {
    const bounces = safeNumber(campaign.report_summary?.bounces)
    console.log(`Campaign ${campaign.id} bounces: ${campaign.report_summary?.bounces} -> ${bounces}`)
    return sum + bounces
  }, 0)
  
  // Calculate rates - Using the same calculation as MailchimpTopCampaignsTable
  // Multiply by 100 to convert decimal to percentage
  const openRate = validCampaigns.length > 0 
    ? (validCampaigns.reduce((sum, campaign) => {
        return sum + safeNumber(campaign.report_summary?.open_rate)
      }, 0) / validCampaigns.length) * 100
    : 0
  
  const clickRate = validCampaigns.length > 0
    ? (validCampaigns.reduce((sum, campaign) => {
        return sum + safeNumber(campaign.report_summary?.click_rate)
      }, 0) / validCampaigns.length) * 100
    : 0
  
  const unsubscribeRate = totalRecipients > 0 ? (totalUnsubscribes / totalRecipients) * 100 : 0
  
  const bounceRate = totalRecipients > 0 ? (totalBounces / totalRecipients) * 100 : 0

  console.log('Calculated metrics:', {
    totalSubscribers,
    totalCampaigns,
    totalRecipients,
    totalOpens,
    totalClicks,
    totalUnsubscribes,
    totalBounces,
    openRate,
    clickRate,
    unsubscribeRate,
    bounceRate
  })

  // Metrics configuration - clean white design
  const metrics = [
    {
      title: "Total Subscribers",
      value: formatNumber(totalSubscribers),
      icon: Users,
      description: audienceDescription,
    },
    {
      title: "Campaigns Sent",
      value: totalCampaigns.toString(),
      icon: Mail,
      description: `In selected period`,
    },
    {
      title: "Emails Sent",
      value: formatNumber(totalRecipients),
      icon: TrendingUp,
      description: `Across ${validCampaigns.length} campaign${validCampaigns.length !== 1 ? 's' : ''}`,
    },
    {
      title: "Open Rate",
      value: `${openRate.toFixed(1)}%`,
      icon: Eye,
      description: "Industry avg: 21.33%",
      badge: getPerformanceBadge(openRate, "open_rate"),
    },
    {
      title: "Click Rate",
      value: `${clickRate.toFixed(2)}%`,
      icon: MousePointer,
      description: "Industry avg: 2.62%",
      badge: getPerformanceBadge(clickRate, "click_rate"),
    },
    {
      title: "Total Opens",
      value: formatNumber(totalOpens),
      icon: BarChart3,
      description: `Unique: ${formatNumber(validCampaigns.reduce((sum, c) => sum + safeNumber(c.report_summary?.unique_opens), 0))}`,
    },
    {
      title: "Total Clicks",
      value: formatNumber(totalClicks),
      icon: MousePointer,
      description: `Link clicks`,
    },
    {
      title: "Bounces",
      value: totalBounces > 0 ? formatNumber(totalBounces) : "0",
      subValue: `${bounceRate.toFixed(2)}%`,
      icon: AlertTriangle,
      description: "Industry avg: 0.70%",
      badge: getPerformanceBadge(bounceRate, "bounce_rate"),
    },
    {
      title: "Unsubscribes",
      value: totalUnsubscribes > 0 ? formatNumber(totalUnsubscribes) : "0",
      subValue: `${unsubscribeRate.toFixed(2)}%`,
      icon: UserMinus,
      description: "Industry avg: 0.21%",
      badge: getPerformanceBadge(unsubscribeRate, "unsubscribe_rate"),
    },
  ]

  return (
    <div className="overflow-hidden w-full max-w-full">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-3 sm:p-4 transition-all hover:bg-neutral-50"
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <metric.icon className="h-4 w-4 text-yellow-600" />
                {metric.badge && (
                  <div className="flex-shrink-0">
                    {metric.badge}
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-bold text-neutral-900">
                  {metric.value}
                </span>
                {metric.subValue && (
                  <span className="text-[10px] sm:text-xs text-neutral-500">
                    ({metric.subValue})
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-neutral-700 mt-1">
                {metric.title}
              </span>
              <p className="mt-1 text-[10px] sm:text-xs text-neutral-500 hidden sm:block">{metric.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

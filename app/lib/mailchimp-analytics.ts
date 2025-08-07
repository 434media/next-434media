import type {
  MailchimpAnalyticsSummary,
  MailchimpCampaignPerformanceData,
  MailchimpSubscriberGrowthData,
  MailchimpEngagementData,
  MailchimpGeographicDataItem,
  MailchimpRealtimeData,
  MailchimpConnectionStatus,
  MailchimpProperty,
  MailchimpList,
  MailchimpCampaign,
  MailchimpCampaignPerformanceResponse,
  MailchimpSubscriberGrowthResponse,
  MailchimpEngagementResponse,
  MailchimpGeographicResponse,
  MailchimpListsResponse,
  MailchimpCampaignsResponse,
} from "../types/mailchimp-analytics"
import { getDefaultAudienceId } from "./mailchimp-config"

// Define a type for the static configuration of Mailchimp properties
interface MailchimpPropertyConfig {
  id: string
  name: string
  key: string
}

// Initialize Mailchimp client
let mailchimpClient: any = null

// Property configurations for the two actual Mailchimp audiences
const MAILCHIMP_PROPERTIES_CONFIG: MailchimpPropertyConfig[] = [
  { id: "434media", name: "434 Media", key: "MAILCHIMP_AUDIENCE_ID_434MEDIA" },
  { id: "txmx", name: "TXMX Founders Tee", key: "MAILCHIMP_AUDIENCE_ID_TXMX" },
]

function getMailchimpClient() {
  if (!mailchimpClient) {
    try {
      const apiKey = process.env.MAILCHIMP_API_KEY
      if (!apiKey) {
        throw new Error("MAILCHIMP_API_KEY environment variable is not set")
      }

      // Extract server prefix from API key (e.g., us1, us2, etc.)
      const serverPrefix = apiKey.split("-")[1]
      if (!serverPrefix) {
        throw new Error("Invalid Mailchimp API key format")
      }

      const baseUrl = `https://${serverPrefix}.api.mailchimp.com/3.0`

      mailchimpClient = {
        apiKey,
        serverPrefix,
        baseUrl,
      }

      console.log("[Mailchimp] Client initialized successfully")
    } catch (error) {
      console.error("[Mailchimp] Failed to initialize client:", error)
      throw error
    }
  }

  return mailchimpClient
}

// Get audience ID from environment variable or use provided audienceId
function getAudienceId(audienceId?: string): string {
  if (audienceId) {
    console.log("[Mailchimp] Using provided audienceId:", audienceId)
    return audienceId
  }

  // Use default audience ID (434 Media preferred, TXMX as fallback)
  const defaultAudienceId = getDefaultAudienceId()
  if (!defaultAudienceId) {
    throw new Error(
      "No Mailchimp audience ID configured. Please set MAILCHIMP_AUDIENCE_ID_434MEDIA or MAILCHIMP_AUDIENCE_ID_TXMX",
    )
  }

  console.log("[Mailchimp] Using default audienceId:", defaultAudienceId)
  return defaultAudienceId
}

// Get all available properties with their configuration status
export async function getAvailableMailchimpProperties(): Promise<MailchimpProperty[]> {
  const properties: MailchimpProperty[] = []

  for (const config of MAILCHIMP_PROPERTIES_CONFIG) {
    const audienceId = process.env[config.key]
    const isConfigured = !!audienceId

    if (isConfigured) {
      try {
        const listData = await makeMailchimpRequest<MailchimpList>(`/lists/${audienceId}`)
        properties.push({
          id: config.id,
          name: config.name,
          isConfigured: true,
          key: config.key,
          list_id: listData.id,
          member_count: listData.stats.member_count,
          campaign_count: listData.stats.campaign_count,
          created_date: listData.date_created,
        })
      } catch (error) {
        console.error(`[Mailchimp] Failed to fetch details for property ${config.name}:`, error)
        properties.push({
          id: config.id,
          name: config.name,
          isConfigured: false,
          key: config.key,
          list_id: "",
          member_count: 0,
          campaign_count: 0,
          created_date: null,
        })
      }
    } else {
      properties.push({
        id: config.id,
        name: config.name,
        isConfigured: false,
        key: config.key,
        list_id: "",
        member_count: 0,
        campaign_count: 0,
        created_date: null,
      })
    }
  }

  return properties
}

// Make authenticated request to Mailchimp API
async function makeMailchimpRequest<T>(endpoint: string): Promise<T> {
  const client = getMailchimpClient()
  const url = `${client.baseUrl}${endpoint}`

  console.log(`[Mailchimp] Making request to: ${url}`)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${client.apiKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Mailchimp] API Error: ${response.status} - ${errorText}`)
    throw new Error(`Mailchimp API Error: ${response.status} - ${response.statusText}`)
  }

  const data = await response.json()
  console.log(`[Mailchimp] Request successful, received ${JSON.stringify(data).length} characters`)

  return data as T
}

// Test connection to Mailchimp API
export async function testMailchimpConnection(audienceId?: string): Promise<MailchimpConnectionStatus> {
  try {
    console.log("[Mailchimp] Testing connection...")

    const targetAudienceId = getAudienceId(audienceId)

    // Test with a simple ping request
    await makeMailchimpRequest("/ping")

    // Test audience access
    const audienceData = await makeMailchimpRequest<MailchimpList>(`/lists/${targetAudienceId}`)

    console.log("[Mailchimp] Connection test successful")

    const availableProperties = await getAvailableMailchimpProperties()

    return {
      success: true,
      configured: true,
      connected: true,
      listId: targetAudienceId,
      listName: audienceData.name,
      memberCount: audienceData.stats?.member_count || 0,
      apiKey: process.env.MAILCHIMP_API_KEY?.substring(0, 8) + "...",
      serverPrefix: getMailchimpClient().serverPrefix,
      availableProperties: availableProperties,
      defaultListId: getDefaultAudienceId(),
    }
  } catch (error) {
    console.error("[Mailchimp] Connection test failed:", error)
    const availableProperties = await getAvailableMailchimpProperties()
    return {
      success: false,
      configured: false,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      availableProperties: availableProperties,
      defaultListId: getDefaultAudienceId(),
    }
  }
}

// Get analytics summary
export async function getMailchimpAnalyticsSummary(
  startDate: string,
  endDate: string,
  audienceId?: string,
): Promise<MailchimpAnalyticsSummary> {
  console.log("[Mailchimp] getMailchimpAnalyticsSummary called with:", { startDate, endDate, audienceId })

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Format dates for Mailchimp API
    const sinceSendTime = new Date(`${startDate}T00:00:00Z`).toISOString()
    const beforeSendTime = new Date(`${endDate}T23:59:59Z`).toISOString()

    // Get audience information
    const audienceData = await makeMailchimpRequest<MailchimpList>(`/lists/${targetAudienceId}`)

    // Get recent campaigns for the date range
    const campaignsData = await makeMailchimpRequest<{ campaigns: MailchimpCampaign[]; total_items: number }>(
      `/campaigns?list_id=${targetAudienceId}&status=sent&since_send_time=${sinceSendTime}&before_send_time=${beforeSendTime}&count=100&fields=campaigns.report_summary,campaigns.send_time,total_items`,
    )

    // Calculate summary metrics from campaigns
    let totalEmailsSent = 0
    let totalOpens = 0
    let totalClicks = 0
    let totalUnsubscribes = 0
    let totalBounces = 0

    if (campaignsData.campaigns && campaignsData.campaigns.length > 0) {
      for (const campaign of campaignsData.campaigns) {
        if (campaign.report_summary) {
          totalEmailsSent += campaign.report_summary.emails_sent || 0
          totalOpens += campaign.report_summary.opens || 0
          totalClicks += campaign.report_summary.clicks || 0
          totalUnsubscribes += campaign.report_summary.unsubscribed || 0
          totalBounces += campaign.report_summary.bounces || 0
        }
      }
    }

    const averageOpenRate = totalEmailsSent > 0 ? (totalOpens / totalEmailsSent) * 100 : 0
    const averageClickRate = totalEmailsSent > 0 ? (totalClicks / totalEmailsSent) * 100 : 0
    const unsubscribeRate = totalEmailsSent > 0 ? (totalUnsubscribes / totalEmailsSent) * 100 : 0
    const averageBounceRate = totalEmailsSent > 0 ? (totalBounces / totalEmailsSent) * 100 : 0

    return {
      totalSubscribers: audienceData.stats?.member_count || 0,
      subscribersChange: 0,
      totalCampaigns: campaignsData.total_items || 0,
      campaignsChange: 0,
      totalEmailsSent,
      emailsSentChange: 0,
      totalOpens,
      opensChange: 0,
      totalClicks,
      clicksChange: 0,
      averageOpenRate,
      openRateChange: 0,
      averageClickRate,
      clickRateChange: 0,
      unsubscribeRate,
      unsubscribeRateChange: 0,
      averageBounceRate,
      bounceRateChange: 0,
      totalRevenue: 0,
      revenueChange: 0,
      listId: targetAudienceId,
      listName: audienceData.name,
      campaignCount: campaignsData.total_items || 0,
      lastCampaignDate:
        campaignsData.campaigns && campaignsData.campaigns.length > 0 ? campaignsData.campaigns[0].send_time : null,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpAnalyticsSummary:", error)
    throw error
  }
}

// Get campaign performance data
export async function getMailchimpCampaignPerformance(
  startDate: string,
  endDate: string,
  audienceId?: string,
): Promise<MailchimpCampaignPerformanceResponse> {
  console.log("[Mailchimp] getMailchimpCampaignPerformance called with:", { startDate, endDate, audienceId })

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Format dates for Mailchimp API
    const sinceSendTime = new Date(`${startDate}T00:00:00Z`).toISOString()
    const beforeSendTime = new Date(`${endDate}T23:59:59Z`).toISOString()

    // Get campaigns for the date range
    const campaignsData = await makeMailchimpRequest<{ campaigns: MailchimpCampaign[]; total_items: number }>(
      `/campaigns?list_id=${targetAudienceId}&status=sent&since_send_time=${sinceSendTime}&before_send_time=${beforeSendTime}&count=100&sort_field=send_time&sort_dir=ASC&fields=campaigns.id,campaigns.settings.title,campaigns.send_time,campaigns.report_summary,total_items`,
    )

    const data: MailchimpCampaignPerformanceData[] = []

    if (campaignsData.campaigns) {
      for (const campaign of campaignsData.campaigns) {
        if (campaign.report_summary && campaign.send_time) {
          const sendDate = new Date(campaign.send_time).toISOString().split("T")[0]

          data.push({
            date: sendDate,
            campaignId: campaign.id,
            campaignTitle: campaign.settings?.title || "Untitled Campaign",
            emailsSent: campaign.report_summary.emails_sent || 0,
            opens: campaign.report_summary.opens || 0,
            clicks: campaign.report_summary.clicks || 0,
            unsubscribes: campaign.report_summary.unsubscribed || 0,
            bounces: campaign.report_summary.bounces || 0,
            openRate: campaign.report_summary.open_rate || 0,
            clickRate: campaign.report_summary.click_rate || 0,
          })
        }
      }
    }

    return {
      data,
      listId: targetAudienceId,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpCampaignPerformance:", error)
    throw error
  }
}

// Get subscriber growth data
export async function getMailchimpSubscriberGrowth(
  startDate: string,
  endDate: string,
  audienceId?: string,
): Promise<MailchimpSubscriberGrowthResponse> {
  console.log("[Mailchimp] getMailchimpSubscriberGrowth called with:", { startDate, endDate, audienceId })

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Get audience growth history
    const growthData = await makeMailchimpRequest<{
      history: {
        month: string
        subscribed: number
        unsubscribed: number
        existing: number
      }[]
    }>(`/lists/${targetAudienceId}/growth-history?since=${startDate}&until=${endDate}&count=100`)

    const data: MailchimpSubscriberGrowthData[] = []

    if (growthData.history) {
      for (const entry of growthData.history) {
        data.push({
          date: entry.month,
          subscribes: entry.subscribed || 0,
          unsubscribes: entry.unsubscribed || 0,
          netGrowth: (entry.subscribed || 0) - (entry.unsubscribed || 0),
          totalSubscribers: entry.existing || 0,
        })
      }
    }

    // Sort by date
    data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return {
      data,
      listId: targetAudienceId,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpSubscriberGrowth:", error)
    throw error
  }
}

// Get engagement data
export async function getMailchimpEngagementData(
  startDate: string,
  endDate: string,
  audienceId?: string,
): Promise<MailchimpEngagementResponse> {
  console.log("[Mailchimp] getMailchimpEngagementData called with:", { startDate, endDate, audienceId })

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Format dates for Mailchimp API
    const sinceSendTime = new Date(`${startDate}T00:00:00Z`).toISOString()
    const beforeSendTime = new Date(`${endDate}T23:59:59Z`).toISOString()

    // Get campaigns and their engagement metrics
    const campaignsData = await makeMailchimpRequest<{ campaigns: MailchimpCampaign[]; total_items: number }>(
      `/campaigns?list_id=${targetAudienceId}&status=sent&since_send_time=${sinceSendTime}&before_send_time=${beforeSendTime}&count=100&fields=campaigns.id,campaigns.settings.title,campaigns.send_time,campaigns.report_summary,total_items`,
    )

    const data: MailchimpEngagementData[] = []

    if (campaignsData.campaigns) {
      for (const campaign of campaignsData.campaigns) {
        if (campaign.report_summary) {
          data.push({
            campaignId: campaign.id,
            campaignTitle: campaign.settings?.title || "Untitled Campaign",
            sendTime: campaign.send_time,
            opens: campaign.report_summary.opens || 0,
            uniqueOpens: campaign.report_summary.unique_opens || 0,
            clicks: campaign.report_summary.clicks || 0,
            uniqueClicks: campaign.report_summary.subscriber_clicks || 0,
            forwards: campaign.report_summary.forwards || 0,
            forwardOpens: campaign.report_summary.forward_opens || 0,
            openRate: campaign.report_summary.open_rate || 0,
            clickRate: campaign.report_summary.click_rate || 0,
          })
        }
      }
    }

    // Sort by send time (most recent first)
    data.sort((a, b) => new Date(b.sendTime).getTime() - new Date(a.sendTime).getTime())

    return {
      data,
      listId: targetAudienceId,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpEngagementData:", error)
    throw error
  }
}

// Get geographic data
export async function getMailchimpGeographicData(audienceId?: string): Promise<MailchimpGeographicResponse> {
  console.log("[Mailchimp] getMailchimpGeographicData called with audienceId:", audienceId)

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Get audience members with location data
    const membersData = await makeMailchimpRequest<{
      members: { location?: { country_code?: string; country?: string } }[]
    }>(`/lists/${targetAudienceId}/members?count=1000&fields=members.location`)

    const locationCounts: Record<string, { country: string; subscribers: number }> = {}

    if (membersData.members) {
      for (const member of membersData.members) {
        if (member.location && member.location.country_code) {
          const countryCode = member.location.country_code
          const countryName = member.location.country || countryCode

          if (!locationCounts[countryCode]) {
            locationCounts[countryCode] = {
              country: countryName,
              subscribers: 0,
            }
          }
          locationCounts[countryCode].subscribers++
        }
      }
    }

    const data: MailchimpGeographicDataItem[] = Object.values(locationCounts)
      .map((item) => ({
        ...item,
        percentage: 0,
        opens: 0,
        clicks: 0,
        openRate: 0,
        clickRate: 0,
      }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 20) // Top 20 countries

    return {
      data,
      listId: targetAudienceId,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpGeographicData:", error)
    throw error
  }
}

// Get lists data
export async function getMailchimpListsData(): Promise<MailchimpListsResponse> {
  console.log("[Mailchimp] getMailchimpListsData called")

  try {
    const listsData = await makeMailchimpRequest<{ lists: MailchimpList[]; total_items: number }>("/lists?count=100")

    const data: MailchimpList[] = listsData.lists || []

    return {
      data,
      totalLists: listsData.total_items || 0,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpListsData:", error)
    throw error
  }
}

// Get campaigns data with full report summary including bounces and unsubscribes
export async function getMailchimpCampaignsData(
  startDate: string,
  endDate: string,
  audienceId?: string,
): Promise<MailchimpCampaignsResponse> {
  console.log("[Mailchimp] getMailchimpCampaignsData called with:", { startDate, endDate, audienceId })

  try {
    // Format dates for Mailchimp API
    const sinceSendTime = new Date(`${startDate}T00:00:00Z`).toISOString()
    const beforeSendTime = new Date(`${endDate}T23:59:59Z`).toISOString()

    let endpoint = `/campaigns?status=sent&since_send_time=${sinceSendTime}&before_send_time=${beforeSendTime}&count=100&sort_field=send_time&sort_dir=DESC`

    // Include ALL report summary fields, especially bounces and unsubscribed
    endpoint += `&fields=campaigns.id,campaigns.settings.title,campaigns.settings.subject_line,campaigns.send_time,campaigns.recipients,campaigns.archive_url,campaigns.report_summary.opens,campaigns.report_summary.unique_opens,campaigns.report_summary.open_rate,campaigns.report_summary.clicks,campaigns.report_summary.subscriber_clicks,campaigns.report_summary.click_rate,campaigns.report_summary.emails_sent,campaigns.report_summary.unsubscribed,campaigns.report_summary.bounces,campaigns.report_summary.forwards,campaigns.report_summary.forward_opens,campaigns.report_summary.ecommerce,total_items`

    if (audienceId) {
      const targetAudienceId = getAudienceId(audienceId)
      endpoint += `&list_id=${targetAudienceId}`
    }

    console.log("[Mailchimp] Fetching campaigns with endpoint:", endpoint)

    const campaignsData = await makeMailchimpRequest<{ campaigns: MailchimpCampaign[]; total_items: number }>(endpoint)

    const data: MailchimpCampaign[] = campaignsData.campaigns || []

    // Log the first campaign's report summary to debug what data we're getting
    if (data.length > 0 && data[0].report_summary) {
      console.log("[Mailchimp] Sample campaign report_summary:", {
        campaignId: data[0].id,
        opens: data[0].report_summary.opens,
        clicks: data[0].report_summary.clicks,
        bounces: data[0].report_summary.bounces,
        unsubscribed: data[0].report_summary.unsubscribed,
        emails_sent: data[0].report_summary.emails_sent,
        open_rate: data[0].report_summary.open_rate,
        click_rate: data[0].report_summary.click_rate,
      })
    }

    return {
      data,
      totalCampaigns: campaignsData.total_items || 0,
      listId: audienceId ? getAudienceId(audienceId) : undefined,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpCampaignsData:", error)
    throw error
  }
}

// Get realtime data (recent activity)
export async function getMailchimpRealtimeData(audienceId?: string): Promise<MailchimpRealtimeData> {
  console.log("[Mailchimp] getMailchimpRealtimeData called with audienceId:", audienceId)

  try {
    const targetAudienceId = getAudienceId(audienceId)

    // Get recent activity (last 24 hours)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayISO = yesterday.toISOString()

    // Get recent campaigns
    const recentCampaigns = await makeMailchimpRequest<{ campaigns: MailchimpCampaign[]; total_items: number }>(
      `/campaigns?list_id=${targetAudienceId}&status=sent&since_send_time=${yesterdayISO}&count=10&fields=campaigns.report_summary,total_items`,
    )

    // Get recent subscribers (approximation using audience activity)
    const audienceData = await makeMailchimpRequest<MailchimpList>(`/lists/${targetAudienceId}`)

    let recentOpens = 0
    let recentClicks = 0
    let recentCampaignCount = 0

    if (recentCampaigns.campaigns) {
      recentCampaignCount = recentCampaigns.campaigns.length

      for (const campaign of recentCampaigns.campaigns) {
        if (campaign.report_summary) {
          recentOpens += campaign.report_summary.opens || 0
          recentClicks += campaign.report_summary.clicks || 0
        }
      }
    }

    return {
      recentSubscribers: 0, // Mailchimp doesn't provide real-time subscriber data easily
      recentOpens,
      recentClicks,
      recentCampaigns: recentCampaignCount,
      totalSubscribers: audienceData.stats?.member_count || 0,
      listId: targetAudienceId,
      listName: audienceData.name,
      _source: "mailchimp",
    }
  } catch (error) {
    console.error("[Mailchimp] Error in getMailchimpRealtimeData:", error)
    throw error
  }
}

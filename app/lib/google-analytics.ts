import { BetaAnalyticsDataClient } from "@google-analytics/data"
import type {
  AnalyticsSummary,
  PageViewsResponse,
  TrafficSourcesResponse,
  DeviceDataResponse,
  GeographicDataResponse,
  DailyMetricsResponse,
  RealtimeData,
  AnalyticsConnectionStatus,
  AnalyticsProperty,
} from "../types/analytics"

// Initialize the client
let analyticsDataClient: BetaAnalyticsDataClient | null = null

// Property configurations
const ANALYTICS_PROPERTIES: AnalyticsProperty[] = [
  { id: "488543948", name: "434 MEDIA", key: "GA4_PROPERTY_ID" },
  { id: "492867424", name: "TXMX Boxing", key: "GA4_PROPERTY_ID_TXMX" },
  { id: "492895637", name: "Vemos Vamos", key: "GA4_PROPERTY_ID_VEMOSVAMOS" },
  { id: "492925168", name: "AIM Health R&D Summit", key: "GA4_PROPERTY_ID_AIM" },
  { id: "492857375", name: "Salute to Troops", key: "GA4_PROPERTY_ID_SALUTE" },
  { id: "488563710", name: "The AMPD Project", key: "GA4_PROPERTY_ID_AMPD" },
  { id: "492925088", name: "Digital Canvas", key: "GA4_PROPERTY_ID_DIGITALCANVAS" },
]

function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (!analyticsDataClient) {
    try {
      const serviceAccountKey = process.env.GA_SERVICE_ACCOUNT_KEY
      if (!serviceAccountKey) {
        throw new Error("GA_SERVICE_ACCOUNT_KEY environment variable is not set")
      }

      let credentials
      try {
        credentials = JSON.parse(serviceAccountKey)
      } catch (parseError) {
        throw new Error("Invalid JSON in GA_SERVICE_ACCOUNT_KEY")
      }

      analyticsDataClient = new BetaAnalyticsDataClient({
        credentials,
        projectId: process.env.GCP_PROJECT_ID,
      })

      console.log("[GA4] Analytics client initialized successfully")
    } catch (error) {
      console.error("[GA4] Failed to initialize analytics client:", error)
      throw error
    }
  }

  return analyticsDataClient
}

// Get property ID from environment variable or use provided propertyId
function getPropertyId(propertyId?: string): string {
  if (propertyId) {
    return propertyId
  }

  // Default to main property
  const defaultPropertyId = process.env.GA4_PROPERTY_ID
  if (!defaultPropertyId) {
    throw new Error("GA4_PROPERTY_ID not configured")
  }

  return defaultPropertyId
}

// Get all available properties with their configuration status
export function getAvailableProperties(): AnalyticsProperty[] {
  return ANALYTICS_PROPERTIES.map((property) => ({
    ...property,
    isConfigured: !!process.env[property.key],
  }))
}

// Test connection to Google Analytics
export async function testAnalyticsConnection(propertyId?: string): Promise<AnalyticsConnectionStatus> {
  try {
    console.log("[GA4] Testing connection...")

    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${targetPropertyId}/metadata`,
    })

    console.log("[GA4] Connection test successful")

    return {
      success: true,
      propertyId: targetPropertyId,
      dimensionCount: response.dimensions?.length || 0,
      metricCount: response.metrics?.length || 0,
      projectId: process.env.GCP_PROJECT_ID,
      availableProperties: getAvailableProperties(),
      defaultPropertyId: process.env.GA4_PROPERTY_ID,
    }
  } catch (error) {
    console.error("[GA4] Connection test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      availableProperties: getAvailableProperties(),
      defaultPropertyId: process.env.GA4_PROPERTY_ID,
    }
  }
}

// Get analytics summary
export async function getAnalyticsSummary(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<AnalyticsSummary> {
  console.log("[GA4] getAnalyticsSummary called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
    })

    const row = response.rows?.[0]
    if (!row?.metricValues) {
      return {
        totalPageViews: 0,
        totalSessions: 0,
        totalUsers: 0,
        bounceRate: 0,
        averageSessionDuration: 0,
        propertyId: targetPropertyId,
      }
    }

    return {
      totalPageViews: Number(row.metricValues[0]?.value || 0),
      totalSessions: Number(row.metricValues[1]?.value || 0),
      totalUsers: Number(row.metricValues[2]?.value || 0),
      bounceRate: Number(row.metricValues[3]?.value || 0),
      averageSessionDuration: Number(row.metricValues[4]?.value || 0),
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getAnalyticsSummary:", error)
    throw error
  }
}

// Get daily metrics
export async function getDailyMetrics(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<DailyMetricsResponse> {
  console.log("[GA4] getDailyMetrics called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "totalUsers" }, { name: "bounceRate" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    })

    console.log("[GA4] Daily metrics raw response:", JSON.stringify(response, null, 2))

    const data =
      response.rows?.map((row) => {
        // Get the date string from the dimension value
        const dateStr = row.dimensionValues?.[0]?.value || ""

        // Log the raw date format from GA4
        console.log(`[GA4] Raw date from GA4: ${dateStr}`)

        // Format the date if it's in YYYYMMDD format (GA4 format)
        let formattedDate = dateStr
        if (/^\d{8}$/.test(dateStr)) {
          const year = dateStr.substring(0, 4)
          const month = dateStr.substring(4, 6)
          const day = dateStr.substring(6, 8)
          formattedDate = `${year}-${month}-${day}`
          console.log(`[GA4] Formatted date: ${formattedDate}`)
        }

        return {
          date: formattedDate,
          pageViews: Number(row.metricValues?.[0]?.value || 0),
          sessions: Number(row.metricValues?.[1]?.value || 0),
          users: Number(row.metricValues?.[2]?.value || 0),
          bounceRate: Number(row.metricValues?.[3]?.value || 0),
        }
      }) || []

    const totalPageViews = data.reduce((sum, day) => sum + day.pageViews, 0)
    const totalSessions = data.reduce((sum, day) => sum + day.sessions, 0)
    const totalUsers = data.reduce((sum, day) => sum + day.users, 0)

    console.log("[GA4] Processed daily metrics:", {
      dataLength: data.length,
      totalPageViews,
      totalSessions,
      totalUsers,
      firstDay: data[0],
      lastDay: data[data.length - 1],
    })

    return {
      data,
      totalPageViews,
      totalSessions,
      totalUsers,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getDailyMetrics:", error)
    throw error
  }
}

// Get page views data
export async function getPageViewsData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<PageViewsResponse> {
  console.log("[GA4] getPageViewsData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    })

    const data =
      response.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        pageViews: Number(row.metricValues?.[0]?.value || 0),
        sessions: Number(row.metricValues?.[1]?.value || 0),
        bounceRate: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getPageViewsData:", error)
    throw error
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<TrafficSourcesResponse> {
  console.log("[GA4] getTrafficSourcesData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    })

    const data =
      response.rows?.map((row) => ({
        source: row.dimensionValues?.[0]?.value || "",
        medium: row.dimensionValues?.[1]?.value || "",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
        newUsers: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getTrafficSourcesData:", error)
    throw error
  }
}

// Get device data
export async function getDeviceData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<DeviceDataResponse> {
  console.log("[GA4] getDeviceData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    })

    const data =
      response.rows?.map((row) => ({
        deviceCategory: row.dimensionValues?.[0]?.value || "",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getDeviceData:", error)
    throw error
  }
}

// Get geographic data
export async function getGeographicData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<GeographicDataResponse> {
  console.log("[GA4] getGeographicData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 50,
    })

    const data =
      response.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        city: row.dimensionValues?.[1]?.value || "",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
        newUsers: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getGeographicData:", error)
    throw error
  }
}

// Get realtime data
export async function getRealtimeData(propertyId?: string): Promise<RealtimeData> {
  console.log("[GA4] getRealtimeData called with propertyId:", propertyId)

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runRealtimeReport({
      property: `properties/${targetPropertyId}`,
      metrics: [{ name: "activeUsers" }],
    })

    const totalActiveUsers = Number(response.rows?.[0]?.metricValues?.[0]?.value || 0)

    // Get top countries for realtime
    const [countriesResponse] = await client.runRealtimeReport({
      property: `properties/${targetPropertyId}`,
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 5,
    })

    const topCountries =
      countriesResponse.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        activeUsers: Number(row.metricValues?.[0]?.value || 0),
      })) || []

    return {
      totalActiveUsers,
      topCountries,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getRealtimeData:", error)
    throw error
  }
}

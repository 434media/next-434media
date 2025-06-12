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
} from "../types/analytics"
import {
  getHistoricalAnalyticsSummary,
  getHistoricalPageViews,
  getHistoricalTrafficSources,
  getHistoricalDeviceData,
  getHistoricalGeographicData,
  getHistoricalDailyMetrics,
} from "./vercel-analytics-db"

// Initialize the client
let analyticsDataClient: BetaAnalyticsDataClient | null = null

function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (!analyticsDataClient) {
    try {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      if (!serviceAccountKey) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set")
      }

      let credentials
      try {
        credentials = JSON.parse(serviceAccountKey)
      } catch (parseError) {
        throw new Error("Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY")
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

// Helper function to check if we should use historical data
function shouldUseHistoricalData(startDate: string, endDate: string): boolean {
  return startDate === "30daysAgo" || startDate === "2024-05-13"
}

// Test connection to Google Analytics
export async function testAnalyticsConnection(): Promise<AnalyticsConnectionStatus> {
  try {
    console.log("[GA4] Testing connection...")

    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      return {
        success: false,
        error: "GA4_PROPERTY_ID not configured",
      }
    }

    const client = getAnalyticsClient()

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${propertyId}/metadata`,
    })

    console.log("[GA4] Connection test successful")

    return {
      success: true,
      propertyId,
      dimensionCount: response.dimensions?.length || 0,
      metricCount: response.metrics?.length || 0,
      projectId: process.env.GCP_PROJECT_ID,
    }
  } catch (error) {
    console.error("[GA4] Connection test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Get analytics summary
export async function getAnalyticsSummary(startDate: string, endDate: string): Promise<AnalyticsSummary> {
  console.log("[GA4] getAnalyticsSummary called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for summary")
      const historicalData = await getHistoricalAnalyticsSummary(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as AnalyticsSummary & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for summary")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
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
      }
    }

    return {
      totalPageViews: Number(row.metricValues[0]?.value || 0),
      totalSessions: Number(row.metricValues[1]?.value || 0),
      totalUsers: Number(row.metricValues[2]?.value || 0),
      bounceRate: Number(row.metricValues[3]?.value || 0),
      averageSessionDuration: Number(row.metricValues[4]?.value || 0),
    }
  } catch (error) {
    console.error("[GA4] Error in getAnalyticsSummary:", error)
    throw error
  }
}

// Get daily metrics
export async function getDailyMetrics(startDate: string, endDate: string): Promise<DailyMetricsResponse> {
  console.log("[GA4] getDailyMetrics called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for daily metrics")
      const historicalData = await getHistoricalDailyMetrics(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as DailyMetricsResponse & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for daily metrics")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "totalUsers" }, { name: "bounceRate" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    })

    const data =
      response.rows?.map((row) => ({
        date: row.dimensionValues?.[0]?.value || "",
        pageViews: Number(row.metricValues?.[0]?.value || 0),
        sessions: Number(row.metricValues?.[1]?.value || 0),
        users: Number(row.metricValues?.[2]?.value || 0),
        bounceRate: Number(row.metricValues?.[3]?.value || 0),
      })) || []

    const totalPageViews = data.reduce((sum, day) => sum + day.pageViews, 0)
    const totalSessions = data.reduce((sum, day) => sum + day.sessions, 0)
    const totalUsers = data.reduce((sum, day) => sum + day.users, 0)

    return {
      data,
      totalPageViews,
      totalSessions,
      totalUsers,
    }
  } catch (error) {
    console.error("[GA4] Error in getDailyMetrics:", error)
    throw error
  }
}

// Get page views data
export async function getPageViewsData(startDate: string, endDate: string): Promise<PageViewsResponse> {
  console.log("[GA4] getPageViewsData called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for page views")
      const historicalData = await getHistoricalPageViews(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as PageViewsResponse & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for page views")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
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

    return { data }
  } catch (error) {
    console.error("[GA4] Error in getPageViewsData:", error)
    throw error
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(startDate: string, endDate: string): Promise<TrafficSourcesResponse> {
  console.log("[GA4] getTrafficSourcesData called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for traffic sources")
      const historicalData = await getHistoricalTrafficSources(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as TrafficSourcesResponse & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for traffic sources")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
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

    return { data }
  } catch (error) {
    console.error("[GA4] Error in getTrafficSourcesData:", error)
    throw error
  }
}

// Get device data
export async function getDeviceData(startDate: string, endDate: string): Promise<DeviceDataResponse> {
  console.log("[GA4] getDeviceData called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for device data")
      const historicalData = await getHistoricalDeviceData(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as DeviceDataResponse & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for device data")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
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

    return { data }
  } catch (error) {
    console.error("[GA4] Error in getDeviceData:", error)
    throw error
  }
}

// Get geographic data
export async function getGeographicData(startDate: string, endDate: string): Promise<GeographicDataResponse> {
  console.log("[GA4] getGeographicData called with:", { startDate, endDate })

  try {
    // Check if we should use historical data
    if (shouldUseHistoricalData(startDate, endDate)) {
      console.log("[GA4] Using historical data for geographic data")
      const historicalData = await getHistoricalGeographicData(startDate, endDate)
      return {
        ...historicalData,
        _source: "vercel-historical",
      } as GeographicDataResponse & { _source: string }
    }

    // Fall back to live GA4 data
    console.log("[GA4] Using live GA4 data for geographic data")
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
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

    return { data }
  } catch (error) {
    console.error("[GA4] Error in getGeographicData:", error)
    throw error
  }
}

// Get realtime data
export async function getRealtimeData(): Promise<RealtimeData> {
  console.log("[GA4] getRealtimeData called")

  try {
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      throw new Error("GA4_PROPERTY_ID not configured")
    }

    const client = getAnalyticsClient()

    const [response] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: "activeUsers" }],
    })

    const totalActiveUsers = Number(response.rows?.[0]?.metricValues?.[0]?.value || 0)

    // Get top countries for realtime
    const [countriesResponse] = await client.runRealtimeReport({
      property: `properties/${propertyId}`,
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
    }
  } catch (error) {
    console.error("[GA4] Error in getRealtimeData:", error)
    throw error
  }
}

import {
  getAnalyticsSummary,
  getPageViewsData,
  getTrafficSourcesData,
  getDeviceData,
  getGeographicData,
  getDailyMetrics,
} from "./google-analytics"

import {
  getHistoricalAnalyticsSummary,
  getHistoricalPageViews,
  getHistoricalTrafficSources,
  getHistoricalDeviceData,
  getHistoricalGeographicData,
  getHistoricalDailyMetrics,
  hasHistoricalData,
  getHistoricalDataRange,
} from "./vercel-analytics-db"

import { testAnalyticsConnection } from "./google-analytics"

import { validatePageViewsData, validateTrafficSourcesData } from "./analytics-normalizer"

import type { AnalyticsSummary } from "../types/analytics"

// The date when GA4 tracking started
const GA4_START_DATE = process.env.GA4_START_DATE || "2023-06-01"

// Determine if we should use historical data for a date range
async function shouldUseHistoricalData(startDate: string, endDate: string): Promise<boolean> {
  // If the entire date range is before GA4 start date, use historical data
  if (new Date(endDate) < new Date(GA4_START_DATE)) {
    return true
  }

  // If the date range spans both periods, check if we have historical data
  if (new Date(startDate) < new Date(GA4_START_DATE) && new Date(endDate) >= new Date(GA4_START_DATE)) {
    return await hasHistoricalData(startDate, endDate)
  }

  // Otherwise use GA4 data
  return false
}

// Get daily metrics with hybrid approach and data normalization
export async function getHybridDailyMetrics(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalDailyMetrics(startDate, endDate)

      // Calculate totals
      const totalPageViews = historicalData.data.reduce((sum: number, day: any) => sum + day.pageViews, 0)
      const totalSessions = historicalData.data.reduce((sum: number, day: any) => sum + day.sessions, 0)
      const totalUsers = historicalData.data.reduce((sum: number, day: any) => sum + day.users, 0)

      return {
        data: historicalData.data.map((day: any) => ({
          date: day.date,
          pageViews: day.pageViews,
          sessions: day.sessions,
          users: day.users,
        })),
        totalPageViews,
        totalSessions,
        totalUsers,
        _hybrid: true,
        _source: "vercel-historical",
      }
    } else {
      const ga4Data = await getDailyMetrics(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
      }
    }
  } catch (error) {
    console.error("Error in getHybridDailyMetrics:", error)
    return {
      data: [],
      totalPageViews: 0,
      totalSessions: 0,
      totalUsers: 0,
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get page views data with hybrid approach and normalization
export async function getHybridPageViewsData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalPageViews(startDate, endDate)

      // Normalize Vercel data to match GA4 structure
      const normalizedData = historicalData.data.map((page: any) => ({
        path: page.path,
        title: page.title,
        pageViews: page.pageViews,
        sessions: page.sessions,
        bounceRate: page.bounceRate,
      }))

      return {
        data: normalizedData,
        _hybrid: true,
        _source: "vercel-historical",
        _normalized: true,
      }
    } else {
      const ga4Data = await getPageViewsData(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
        _normalized: true,
      }
    }
  } catch (error) {
    console.error("Error in getHybridPageViewsData:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get top pages with hybrid approach
export async function getHybridTopPages(startDate: string, endDate: string, limit = 10) {
  try {
    const pagesData = await getHybridPageViewsData(startDate, endDate)

    // Validate and clean data
    const { valid: validPages, issues } = validatePageViewsData(pagesData.data)

    if (issues.length > 0) {
      console.warn("Data quality issues in top pages:", issues)
    }

    // Sort by page views and take top N
    return {
      data: validPages
        .sort((a: any, b: any) => b.pageViews - a.pageViews)
        .slice(0, limit)
        .map((page: any) => ({
          path: page.path,
          title: page.title || page.path,
          pageViews: page.pageViews,
          sessions: page.sessions,
          bounceRate: page.bounceRate || 0,
        })),
      _hybrid: true,
      _source: pagesData._source,
      _dataQuality: {
        validRecords: validPages.length,
        totalRecords: pagesData.data.length,
        issues: issues.length,
      },
    }
  } catch (error) {
    console.error("Error in getHybridTopPages:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get traffic sources data with hybrid approach
export async function getHybridTrafficSourcesData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalTrafficSources(startDate, endDate)

      return {
        data: historicalData.data.map((source: any) => ({
          source: source.source,
          medium: source.medium || "referral", // Default medium for Vercel data
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })),
        _hybrid: true,
        _source: "vercel-historical",
        _normalized: true,
      }
    } else {
      const ga4Data = await getTrafficSourcesData(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
        _normalized: true,
      }
    }
  } catch (error) {
    console.error("Error in getHybridTrafficSourcesData:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Add this function after getHybridTrafficSourcesData

// Get referrers data with hybrid approach (specifically handling Vercel's referrer format)
export async function getHybridReferrersData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalTrafficSources(startDate, endDate)

      // Use the specialized referrer normalization for Vercel data
      const normalizedData = historicalData.data.map((source: any) => ({
        source: source.source || source.referrer || "(direct)",
        medium: source.medium || inferMediumFromReferrer(source.source || source.referrer || ""),
        sessions: source.sessions || source.visits || 0,
        users: source.users || source.visitors || 0,
        newUsers: source.newUsers || source.new_visitors || 0,
      }))

      return {
        data: normalizedData,
        _hybrid: true,
        _source: "vercel-historical",
        _normalized: true,
        _dataType: "referrers", // Mark this as referrer data
      }
    } else {
      // For GA4, we use the traffic sources data but label it as referrers
      const ga4Data = await getTrafficSourcesData(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
        _normalized: true,
        _dataType: "referrers", // Mark this as referrer data
      }
    }
  } catch (error) {
    console.error("Error in getHybridReferrersData:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Add this utility function
function inferMediumFromReferrer(referrer: string): string {
  if (!referrer || referrer === "(direct)" || referrer === "direct") {
    return "none"
  }

  const lowerRef = referrer.toLowerCase()

  // Social media
  if (
    lowerRef.includes("facebook") ||
    lowerRef.includes("twitter") ||
    lowerRef.includes("linkedin") ||
    lowerRef.includes("instagram") ||
    lowerRef.includes("pinterest") ||
    lowerRef.includes("reddit") ||
    lowerRef.includes("tiktok") ||
    lowerRef.includes("youtube")
  ) {
    return "social"
  }

  // Search engines
  if (
    lowerRef.includes("google") ||
    lowerRef.includes("bing") ||
    lowerRef.includes("yahoo") ||
    lowerRef.includes("duckduckgo") ||
    lowerRef.includes("baidu") ||
    lowerRef.includes("yandex")
  ) {
    return "organic"
  }

  // Email providers
  if (
    lowerRef.includes("mail") ||
    lowerRef.includes("outlook") ||
    lowerRef.includes("gmail") ||
    lowerRef.includes("yahoo") ||
    lowerRef.includes("newsletter")
  ) {
    return "email"
  }

  return "referral"
}

// Update getHybridTopTrafficSources to handle referrers
export async function getHybridTopReferrers(startDate: string, endDate: string, limit = 10) {
  try {
    // Use the specialized referrers data function
    const referrersData = await getHybridReferrersData(startDate, endDate)

    // Validate and clean data
    const { valid: validReferrers, issues } = validateTrafficSourcesData(referrersData.data)

    if (issues.length > 0) {
      console.warn("Data quality issues in referrers:", issues)
    }

    // Sort by sessions and take top N
    return {
      data: validReferrers
        .sort((a: any, b: any) => b.sessions - a.sessions)
        .slice(0, limit)
        .map((source: any) => ({
          source: source.source,
          medium: source.medium || "referral",
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })),
      _hybrid: true,
      _source: referrersData._source,
      _dataType: "referrers",
      _dataQuality: {
        validRecords: validReferrers.length,
        totalRecords: referrersData.data.length,
        issues: issues.length,
      },
    }
  } catch (error) {
    console.error("Error in getHybridTopReferrers:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get top traffic sources with hybrid approach
export async function getHybridTopTrafficSources(startDate: string, endDate: string, limit = 10) {
  try {
    const sourcesData = await getHybridTrafficSourcesData(startDate, endDate)

    // Validate and clean data
    const { valid: validSources, issues } = validateTrafficSourcesData(sourcesData.data)

    if (issues.length > 0) {
      console.warn("Data quality issues in traffic sources:", issues)
    }

    // Sort by sessions and take top N
    return {
      data: validSources
        .sort((a: any, b: any) => b.sessions - a.sessions)
        .slice(0, limit)
        .map((source: any) => ({
          source: source.source,
          medium: source.medium || "referral",
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })),
      _hybrid: true,
      _source: sourcesData._source,
      _dataQuality: {
        validRecords: validSources.length,
        totalRecords: sourcesData.data.length,
        issues: issues.length,
      },
    }
  } catch (error) {
    console.error("Error in getHybridTopTrafficSources:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get device data with hybrid approach
export async function getHybridDeviceData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalDeviceData(startDate, endDate)

      return {
        data: historicalData.data.map((device: any) => ({
          deviceCategory: device.deviceCategory,
          sessions: device.sessions,
          users: device.users,
        })),
        _hybrid: true,
        _source: "vercel-historical",
        _normalized: true,
      }
    } else {
      const ga4Data = await getDeviceData(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
        _normalized: true,
      }
    }
  } catch (error) {
    console.error("Error in getHybridDeviceData:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get geographic data with hybrid approach
export async function getHybridGeographicData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalGeographicData(startDate, endDate)

      return {
        data: historicalData.data.map((geo: any) => ({
          country: geo.country,
          city: geo.city,
          sessions: geo.sessions,
          users: geo.users,
          newUsers: geo.newUsers,
        })),
        _hybrid: true,
        _source: "vercel-historical",
        _normalized: true,
      }
    } else {
      const ga4Data = await getGeographicData(startDate, endDate)
      return {
        ...ga4Data,
        _hybrid: true,
        _source: "google-analytics",
        _normalized: true,
      }
    }
  } catch (error) {
    console.error("Error in getHybridGeographicData:", error)
    return {
      data: [],
      _hybrid: true,
      _source: "error",
      _error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get analytics summary with hybrid approach
export async function getHybridAnalyticsSummary(startDate: string, endDate: string): Promise<AnalyticsSummary> {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      return await getHistoricalAnalyticsSummary(startDate, endDate)
    } else {
      return await getAnalyticsSummary(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridAnalyticsSummary:", error)
    return {
      totalPageViews: 0,
      totalSessions: 0,
      totalUsers: 0,
      bounceRate: 0,
      averageSessionDuration: 0,
    }
  }
}

// Data source information function
export async function getDataSourceInfo(): Promise<{
  vercelAnalytics: {
    available: boolean
    recordCount?: number
    dateRange?: { start: string; end: string }
  }
  googleAnalytics: {
    available: boolean
    configured: boolean
  }
  compatibility: {
    normalizationEnabled: boolean
    dataQualityChecks: boolean
    supportedFormats: string[]
  }
}> {
  try {
    // Check Vercel Analytics data availability using existing functions
    const historicalRange = await getHistoricalDataRange()
    const vercelAvailable = !!historicalRange

    let recordCount = 0
    if (vercelAvailable && historicalRange) {
      // Get a sample of historical data to count records
      const sampleData = await getHistoricalPageViews(historicalRange.startDate, historicalRange.endDate)
      recordCount = sampleData.data.length
    }

    // Check Google Analytics configuration
    const gaConfigured = !!(
      process.env.GOOGLE_ANALYTICS_PROPERTY_ID &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_PRIVATE_KEY)
    )

    let gaAvailable = false
    if (gaConfigured) {
      try {
        await testAnalyticsConnection()
        gaAvailable = true
      } catch {
        gaAvailable = false
      }
    }

    return {
      vercelAnalytics: {
        available: vercelAvailable,
        recordCount,
        dateRange: historicalRange
          ? {
              start: historicalRange.startDate,
              end: historicalRange.endDate,
            }
          : undefined,
      },
      googleAnalytics: {
        available: gaAvailable,
        configured: gaConfigured,
      },
      compatibility: {
        normalizationEnabled: true,
        dataQualityChecks: true,
        supportedFormats: ["vercel-csv", "google-analytics-4", "custom-csv"],
      },
    }
  } catch (error) {
    console.error("Error getting data source info:", error)
    return {
      vercelAnalytics: {
        available: false,
      },
      googleAnalytics: {
        available: false,
        configured: false,
      },
      compatibility: {
        normalizationEnabled: true,
        dataQualityChecks: true,
        supportedFormats: [],
      },
    }
  }
}

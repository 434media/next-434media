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
  getHistoricalDataRange,
} from "./vercel-analytics-db"

import { testAnalyticsConnection } from "./google-analytics"
import { getGA4StartDate } from "./analytics-config"
import { validatePageViewsData, validateTrafficSourcesData } from "./analytics-normalizer"
import { shouldUseHistoricalData, getDataSourceStrategy } from "./analytics-strategy"

import type { AnalyticsSummary, HybridAnalyticsResponse } from "../types/analytics"

// Combine historical and GA4 data
function combineData<T>(historicalData: T[], ga4Data: T[], combineFunction: (hist: T[], ga4: T[]) => T[]): T[] {
  if (historicalData.length === 0) return ga4Data
  if (ga4Data.length === 0) return historicalData
  return combineFunction(historicalData, ga4Data)
}

// Get daily metrics with hybrid approach
export async function getHybridDailyMetrics(startDate: string, endDate: string): Promise<HybridAnalyticsResponse<any>> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let historicalData: any[] = []
    let ga4Data: any[] = []
    let totalPageViews = 0
    let totalSessions = 0
    let totalUsers = 0

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalDailyMetrics(strategy.historicalStart, strategy.historicalEnd)
      historicalData = historical.data
      totalPageViews += historical.totalPageViews
      totalSessions += historical.totalSessions
      totalUsers += historical.totalUsers
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getDailyMetrics(strategy.ga4Start, strategy.ga4End)
      ga4Data = ga4.data
      totalPageViews += ga4.totalPageViews
      totalSessions += ga4.totalSessions
      totalUsers += ga4.totalUsers
    }

    const combinedData = combineData(historicalData, ga4Data, (hist, ga4) => [...hist, ...ga4])

    return {
      data: combinedData,
      totalPageViews,
      totalSessions,
      totalUsers,
      _hybrid: true,
      _historicalDays: historicalData.length,
      _ga4Days: ga4Data.length,
      _strategy: strategy.strategy,
      _historicalData: historicalData,
      _ga4Data: ga4Data,
    }
  } catch (error) {
    console.error("Error in getHybridDailyMetrics:", error)
    throw new Error(`Failed to fetch daily metrics: ${error instanceof Error ? error.message : "Unknown error"}`)
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
export async function getHybridTopPages(
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<HybridAnalyticsResponse<any>> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let historicalData: any[] = []
    let ga4Data: any[] = []

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalPageViews(strategy.historicalStart, strategy.historicalEnd)
      historicalData = historical.data
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getPageViewsData(strategy.ga4Start, strategy.ga4End)
      ga4Data = ga4.data
    }

    // Combine and aggregate page data
    const pageMap = new Map<string, any>()

    // Add historical data
    historicalData.forEach((page) => {
      pageMap.set(page.path, {
        path: page.path,
        title: page.title || page.path,
        pageViews: page.pageViews,
        sessions: page.sessions,
        bounceRate: page.bounceRate || 0,
      })
    })

    // Add GA4 data (merge with existing or create new)
    ga4Data.forEach((page) => {
      const existing = pageMap.get(page.path)
      if (existing) {
        existing.pageViews += page.pageViews
        existing.sessions += page.sessions
        existing.bounceRate = (existing.bounceRate + page.bounceRate) / 2 // Average bounce rate
      } else {
        pageMap.set(page.path, {
          path: page.path,
          title: page.title || page.path,
          pageViews: page.pageViews,
          sessions: page.sessions,
          bounceRate: page.bounceRate || 0,
        })
      }
    })

    const combinedData = Array.from(pageMap.values())
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, limit)

    // Validate data
    const { valid: validPages, issues } = validatePageViewsData(combinedData)

    return {
      data: validPages,
      _hybrid: true,
      _historicalPages: historicalData.length,
      _ga4Pages: ga4Data.length,
      _strategy: strategy.strategy,
      _dataQuality: {
        validRecords: validPages.length,
        totalRecords: combinedData.length,
        issues: issues.length,
      },
    }
  } catch (error) {
    console.error("Error in getHybridTopPages:", error)
    throw new Error(`Failed to fetch top pages: ${error instanceof Error ? error.message : "Unknown error"}`)
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

// Get top traffic sources with hybrid approach
export async function getHybridTopTrafficSources(
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<HybridAnalyticsResponse<any>> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let historicalData: any[] = []
    let ga4Data: any[] = []

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalTrafficSources(strategy.historicalStart, strategy.historicalEnd)
      historicalData = historical.data
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getTrafficSourcesData(strategy.ga4Start, strategy.ga4End)
      ga4Data = ga4.data
    }

    // Combine and aggregate traffic source data
    const sourceMap = new Map<string, any>()

    // Add historical data
    historicalData.forEach((source) => {
      const key = `${source.source}|${source.medium || "referral"}`
      sourceMap.set(key, {
        source: source.source,
        medium: source.medium || "referral",
        sessions: source.sessions,
        users: source.users,
        newUsers: source.newUsers,
      })
    })

    // Add GA4 data
    ga4Data.forEach((source) => {
      const key = `${source.source}|${source.medium}`
      const existing = sourceMap.get(key)
      if (existing) {
        existing.sessions += source.sessions
        existing.users += source.users
        existing.newUsers += source.newUsers
      } else {
        sourceMap.set(key, {
          source: source.source,
          medium: source.medium,
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })
      }
    })

    const combinedData = Array.from(sourceMap.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, limit)

    // Validate data
    const { valid: validSources, issues } = validateTrafficSourcesData(combinedData)

    return {
      data: validSources,
      _hybrid: true,
      _strategy: strategy.strategy,
      _dataQuality: {
        validRecords: validSources.length,
        totalRecords: combinedData.length,
        issues: issues.length,
      },
    }
  } catch (error) {
    console.error("Error in getHybridTopTrafficSources:", error)
    throw new Error(`Failed to fetch traffic sources: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get device data with hybrid approach
export async function getHybridDeviceData(startDate: string, endDate: string): Promise<HybridAnalyticsResponse<any>> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let historicalData: any[] = []
    let ga4Data: any[] = []

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalDeviceData(strategy.historicalStart, strategy.historicalEnd)
      historicalData = historical.data
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getDeviceData(strategy.ga4Start, strategy.ga4End)
      ga4Data = ga4.data
    }

    // Combine device data
    const deviceMap = new Map<string, any>()

    // Add historical data
    historicalData.forEach((device) => {
      deviceMap.set(device.deviceCategory, {
        deviceCategory: device.deviceCategory,
        sessions: device.sessions,
        users: device.users,
      })
    })

    // Add GA4 data
    ga4Data.forEach((device) => {
      const existing = deviceMap.get(device.deviceCategory)
      if (existing) {
        existing.sessions += device.sessions
        existing.users += device.users
      } else {
        deviceMap.set(device.deviceCategory, {
          deviceCategory: device.deviceCategory,
          sessions: device.sessions,
          users: device.users,
        })
      }
    })

    const combinedData = Array.from(deviceMap.values()).sort((a, b) => b.sessions - a.sessions)

    return {
      data: combinedData,
      _hybrid: true,
      _strategy: strategy.strategy,
    }
  } catch (error) {
    console.error("Error in getHybridDeviceData:", error)
    throw new Error(`Failed to fetch device data: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get geographic data with hybrid approach
export async function getHybridGeographicData(
  startDate: string,
  endDate: string,
): Promise<HybridAnalyticsResponse<any>> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let historicalData: any[] = []
    let ga4Data: any[] = []

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalGeographicData(strategy.historicalStart, strategy.historicalEnd)
      historicalData = historical.data
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getGeographicData(strategy.ga4Start, strategy.ga4End)
      ga4Data = ga4.data
    }

    // Combine geographic data
    const geoMap = new Map<string, any>()

    // Add historical data
    historicalData.forEach((geo) => {
      const key = `${geo.country}|${geo.city || ""}`
      geoMap.set(key, {
        country: geo.country,
        city: geo.city || "",
        sessions: geo.sessions,
        users: geo.users,
        newUsers: geo.newUsers,
      })
    })

    // Add GA4 data
    ga4Data.forEach((geo) => {
      const key = `${geo.country}|${geo.city || ""}`
      const existing = geoMap.get(key)
      if (existing) {
        existing.sessions += geo.sessions
        existing.users += geo.users
        existing.newUsers += geo.newUsers
      } else {
        geoMap.set(key, {
          country: geo.country,
          city: geo.city || "",
          sessions: geo.sessions,
          users: geo.users,
          newUsers: geo.newUsers,
        })
      }
    })

    const combinedData = Array.from(geoMap.values())
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20)

    return {
      data: combinedData,
      _hybrid: true,
      _strategy: strategy.strategy,
    }
  } catch (error) {
    console.error("Error in getHybridGeographicData:", error)
    throw new Error(`Failed to fetch geographic data: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get analytics summary with hybrid approach
export async function getHybridAnalyticsSummary(
  startDate: string,
  endDate: string,
): Promise<AnalyticsSummary & { _hybrid?: boolean; _strategy?: string }> {
  try {
    const strategy = await getDataSourceStrategy(startDate, endDate)

    let totalPageViews = 0
    let totalSessions = 0
    let totalUsers = 0
    let bounceRate = 0
    let averageSessionDuration = 0
    let dataPoints = 0

    if (strategy.useHistorical && strategy.historicalStart && strategy.historicalEnd) {
      const historical = await getHistoricalAnalyticsSummary(strategy.historicalStart, strategy.historicalEnd)
      totalPageViews += historical.totalPageViews
      totalSessions += historical.totalSessions
      totalUsers += historical.totalUsers
      bounceRate += historical.bounceRate
      averageSessionDuration += historical.averageSessionDuration
      dataPoints++
    }

    if (strategy.useGA4 && strategy.ga4Start && strategy.ga4End) {
      const ga4 = await getAnalyticsSummary(strategy.ga4Start, strategy.ga4End)
      totalPageViews += ga4.totalPageViews
      totalSessions += ga4.totalSessions
      totalUsers += ga4.totalUsers
      bounceRate += ga4.bounceRate
      averageSessionDuration += ga4.averageSessionDuration
      dataPoints++
    }

    return {
      totalPageViews,
      totalSessions,
      totalUsers,
      bounceRate: dataPoints > 0 ? bounceRate / dataPoints : 0,
      averageSessionDuration: dataPoints > 0 ? averageSessionDuration / dataPoints : 0,
      _hybrid: true,
      _strategy: strategy.strategy,
    }
  } catch (error) {
    console.error("Error in getHybridAnalyticsSummary:", error)
    throw new Error(`Failed to fetch analytics summary: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get top referrers with hybrid approach (alias for top traffic sources)
export async function getHybridTopReferrers(
  startDate: string,
  endDate: string,
  limit = 10,
): Promise<HybridAnalyticsResponse<any>> {
  return getHybridTopTrafficSources(startDate, endDate, limit)
}

// Utility function to infer medium from referrer
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
    ga4StartDate: string
  }
  compatibility: {
    normalizationEnabled: boolean
    dataQualityChecks: boolean
    supportedFormats: string[]
  }
}> {
  try {
    // Check Vercel Analytics data availability
    const historicalRange = await getHistoricalDataRange()
    const vercelAvailable = !!historicalRange

    let recordCount = 0
    if (vercelAvailable && historicalRange) {
      const sampleData = await getHistoricalPageViews(historicalRange.startDate, historicalRange.endDate)
      recordCount = sampleData.data.length
    }

    // Check Google Analytics configuration
    let gaAvailable = false
    try {
      const connectionTest = await testAnalyticsConnection()
      gaAvailable = connectionTest.success
    } catch {
      gaAvailable = false
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
        configured: true, // We assume it's configured if we reach this point
        ga4StartDate: getGA4StartDate(),
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
        ga4StartDate: getGA4StartDate(),
      },
      compatibility: {
        normalizationEnabled: true,
        dataQualityChecks: true,
        supportedFormats: [],
      },
    }
  }
}

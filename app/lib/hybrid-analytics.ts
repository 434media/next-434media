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

import type { AnalyticsSummary } from "../types/analytics"

// The date when GA4 tracking started
const GA4_START_DATE = process.env.GA4_START_DATE || "2025-06-10"

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

// Get daily metrics with hybrid approach
export async function getHybridDailyMetrics(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalDailyMetrics(startDate, endDate)

      // Calculate totals
      const totalPageViews = historicalData.data.reduce((sum: number, day: any) => sum + day.pageViews, 0)
      const totalSessions = historicalData.data.reduce((sum: number, day: any) => sum + day.sessions, 0)
      const totalUsers = historicalData.data.reduce((sum: number, day: any) => sum + day.activeUsers, 0)

      return {
        data: historicalData.data.map((day: any) => ({
          date: day.date,
          pageViews: day.pageViews,
          sessions: day.sessions,
          users: day.activeUsers,
        })),
        totalPageViews,
        totalSessions,
        totalUsers,
      }
    } else {
      return await getDailyMetrics(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridDailyMetrics:", error)
    return {
      data: [],
      totalPageViews: 0,
      totalSessions: 0,
      totalUsers: 0,
    }
  }
}

// Get page views data with hybrid approach
export async function getHybridPageViewsData(startDate: string, endDate: string) {
  try {
    const useHistorical = await shouldUseHistoricalData(startDate, endDate)

    if (useHistorical) {
      const historicalData = await getHistoricalPageViews(startDate, endDate)

      return {
        data: historicalData.data.map((page: any) => ({
          path: page.path,
          title: page.title,
          pageViews: page.pageViews,
          sessions: page.sessions,
          bounceRate: page.bounceRate,
        })),
      }
    } else {
      return await getPageViewsData(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridPageViewsData:", error)
    return {
      data: [],
    }
  }
}

// Get top pages with hybrid approach
export async function getHybridTopPages(startDate: string, endDate: string, limit = 10) {
  try {
    const pagesData = await getHybridPageViewsData(startDate, endDate)

    // Sort by page views and take top N
    return {
      data: pagesData.data
        .sort((a: any, b: any) => b.pageViews - a.pageViews)
        .slice(0, limit)
        .map((page: any) => ({
          path: page.path,
          title: page.title || page.path,
          pageViews: page.pageViews,
          sessions: page.sessions,
          bounceRate: page.bounceRate || 0,
        })),
    }
  } catch (error) {
    console.error("Error in getHybridTopPages:", error)
    return {
      data: [],
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
          medium: source.medium,
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })),
      }
    } else {
      return await getTrafficSourcesData(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridTrafficSourcesData:", error)
    return {
      data: [],
    }
  }
}

// Get top traffic sources with hybrid approach
export async function getHybridTopTrafficSources(startDate: string, endDate: string, limit = 10) {
  try {
    const sourcesData = await getHybridTrafficSourcesData(startDate, endDate)

    // Sort by sessions and take top N
    return {
      data: sourcesData.data
        .sort((a: any, b: any) => b.sessions - a.sessions)
        .slice(0, limit)
        .map((source: any) => ({
          source: source.source,
          medium: source.medium || "referral",
          sessions: source.sessions,
          users: source.users,
          newUsers: source.newUsers,
        })),
    }
  } catch (error) {
    console.error("Error in getHybridTopTrafficSources:", error)
    return {
      data: [],
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
      }
    } else {
      return await getDeviceData(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridDeviceData:", error)
    return {
      data: [],
    }
  }
}

// Get device breakdown with hybrid approach
export async function getHybridDeviceBreakdown(startDate: string, endDate: string) {
  try {
    const devicesData = await getHybridDeviceData(startDate, endDate)

    // Calculate totals and percentages
    const totalSessions = devicesData.data.reduce((sum: number, device: any) => sum + device.sessions, 0)

    return {
      data: devicesData.data.map((device: any) => ({
        deviceCategory: device.deviceCategory,
        sessions: device.sessions,
        users: device.users,
        percentage: totalSessions > 0 ? (device.sessions / totalSessions) * 100 : 0,
      })),
    }
  } catch (error) {
    console.error("Error in getHybridDeviceBreakdown:", error)
    return {
      data: [],
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
      }
    } else {
      return await getGeographicData(startDate, endDate)
    }
  } catch (error) {
    console.error("Error in getHybridGeographicData:", error)
    return {
      data: [],
    }
  }
}

// Get top countries with hybrid approach
export async function getHybridTopCountries(startDate: string, endDate: string, limit = 10) {
  try {
    const geoData = await getHybridGeographicData(startDate, endDate)

    // Group by country and sum sessions
    const countryMap = new Map<string, { sessions: number; users: number; newUsers: number }>()

    geoData.data.forEach((geo: any) => {
      const country = geo.country
      if (!countryMap.has(country)) {
        countryMap.set(country, { sessions: 0, users: 0, newUsers: 0 })
      }

      const current = countryMap.get(country)!
      current.sessions += geo.sessions
      current.users += geo.users
      current.newUsers += geo.newUsers
    })

    // Convert to array, sort, and take top N
    return {
      data: Array.from(countryMap.entries())
        .map(([country, data]) => ({
          country,
          sessions: data.sessions,
          users: data.users,
          newUsers: data.newUsers,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, limit),
    }
  } catch (error) {
    console.error("Error in getHybridTopCountries:", error)
    return {
      data: [],
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
    }
  }
}

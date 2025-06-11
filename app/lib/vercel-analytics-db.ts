import { neon } from "@neondatabase/serverless"
import type {
  AnalyticsSummary,
  PageViewsResponse,
  TrafficSourcesResponse,
  DeviceDataResponse,
  GeographicDataResponse,
  DailyMetricsResponse,
} from "../types/analytics"

const sql = neon(process.env.DATABASE_URL!)

// Get historical page views from Vercel analytics data
export async function getHistoricalPageViews(startDate: string, endDate: string): Promise<PageViewsResponse> {
  try {
    const result = await sql`
      SELECT 
        page_path as path, 
        page_title as title, 
        views as "pageViews", 
        unique_visitors as sessions,
        bounce_rate as "bounceRate"
      FROM vercel_page_views
      WHERE date BETWEEN ${startDate} AND ${endDate}
      ORDER BY views DESC
    `

    return {
      data: result.map((row) => ({
        path: row.path,
        title: row.title || row.path,
        pageViews: Number(row.pageViews),
        sessions: Number(row.sessions),
        bounceRate: Number(row.bounceRate || 0),
      })),
    }
  } catch (error) {
    console.error("Error fetching historical page views:", error)
    return { data: [] }
  }
}

// Get historical traffic sources from Vercel analytics data
export async function getHistoricalTrafficSources(startDate: string, endDate: string): Promise<TrafficSourcesResponse> {
  try {
    const result = await sql`
      SELECT 
        source, 
        medium, 
        SUM(sessions) as sessions, 
        SUM(users) as users, 
        SUM(new_users) as "newUsers"
      FROM vercel_traffic_sources
      WHERE date BETWEEN ${startDate} AND ${endDate}
      GROUP BY source, medium
      ORDER BY SUM(sessions) DESC
    `

    return {
      data: result.map((row) => ({
        source: row.source,
        medium: row.medium,
        sessions: Number(row.sessions),
        users: Number(row.users),
        newUsers: Number(row.newUsers),
      })),
    }
  } catch (error) {
    console.error("Error fetching historical traffic sources:", error)
    return { data: [] }
  }
}

// Get historical device data from Vercel analytics data
export async function getHistoricalDeviceData(startDate: string, endDate: string): Promise<DeviceDataResponse> {
  try {
    const result = await sql`
      SELECT 
        device_category as "deviceCategory", 
        SUM(sessions) as sessions, 
        SUM(users) as users
      FROM vercel_device_data
      WHERE date BETWEEN ${startDate} AND ${endDate}
      GROUP BY device_category
      ORDER BY SUM(sessions) DESC
    `

    return {
      data: result.map((row) => ({
        deviceCategory: row.deviceCategory,
        sessions: Number(row.sessions),
        users: Number(row.users),
      })),
    }
  } catch (error) {
    console.error("Error fetching historical device data:", error)
    return { data: [] }
  }
}

// Get historical geographic data from Vercel analytics data
export async function getHistoricalGeographicData(startDate: string, endDate: string): Promise<GeographicDataResponse> {
  try {
    const result = await sql`
      SELECT 
        country, 
        city, 
        SUM(sessions) as sessions, 
        SUM(users) as users, 
        SUM(new_users) as "newUsers"
      FROM vercel_geographic_data
      WHERE date BETWEEN ${startDate} AND ${endDate}
      GROUP BY country, city
      ORDER BY SUM(sessions) DESC
    `

    return {
      data: result.map((row) => ({
        country: row.country,
        city: row.city || "",
        sessions: Number(row.sessions),
        users: Number(row.users),
        newUsers: Number(row.newUsers),
      })),
    }
  } catch (error) {
    console.error("Error fetching historical geographic data:", error)
    return { data: [] }
  }
}

// Get historical daily metrics from Vercel analytics data
export async function getHistoricalDailyMetrics(startDate: string, endDate: string): Promise<DailyMetricsResponse> {
  try {
    const result = await sql`
      SELECT 
        date, 
        total_page_views as "pageViews", 
        total_sessions as sessions, 
        total_users as users,
        bounce_rate as "bounceRate"
      FROM vercel_daily_summary
      WHERE date BETWEEN ${startDate} AND ${endDate}
      ORDER BY date ASC
    `

    const data = result.map((row) => ({
      date: row.date,
      pageViews: Number(row.pageViews),
      sessions: Number(row.sessions),
      users: Number(row.users),
      bounceRate: Number(row.bounceRate || 0),
    }))

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
    console.error("Error fetching historical daily metrics:", error)
    return {
      data: [],
      totalPageViews: 0,
      totalSessions: 0,
      totalUsers: 0,
    }
  }
}

// Get historical analytics summary from Vercel analytics data
export async function getHistoricalAnalyticsSummary(startDate: string, endDate: string): Promise<AnalyticsSummary> {
  try {
    const result = await sql`
      SELECT 
        SUM(total_page_views) as "totalPageViews",
        SUM(total_sessions) as "totalSessions",
        SUM(total_users) as "totalUsers",
        AVG(bounce_rate) as "bounceRate",
        AVG(avg_session_duration) as "averageSessionDuration"
      FROM vercel_daily_summary
      WHERE date BETWEEN ${startDate} AND ${endDate}
    `

    if (result.length === 0) {
      return {
        totalPageViews: 0,
        totalSessions: 0,
        totalUsers: 0,
        bounceRate: 0,
        averageSessionDuration: 0,
      }
    }

    const row = result[0]
    return {
      totalPageViews: Number(row.totalPageViews || 0),
      totalSessions: Number(row.totalSessions || 0),
      totalUsers: Number(row.totalUsers || 0),
      bounceRate: Number(row.bounceRate || 0),
      averageSessionDuration: Number(row.averageSessionDuration || 0),
    }
  } catch (error) {
    console.error("Error fetching historical analytics summary:", error)
    return {
      totalPageViews: 0,
      totalSessions: 0,
      totalUsers: 0,
      bounceRate: 0,
      averageSessionDuration: 0,
    }
  }
}

// Check if we have historical data for a given date range
export async function hasHistoricalData(startDate: string, endDate: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM vercel_daily_summary
      WHERE date BETWEEN ${startDate} AND ${endDate}
    `

    return Number(result[0]?.count) > 0
  } catch (error) {
    console.error("Error checking for historical data:", error)
    return false
  }
}

// Get the date range where we have historical data
export async function getHistoricalDataRange(): Promise<{ startDate: string; endDate: string } | null> {
  try {
    const result = await sql`
      SELECT 
        MIN(date) as "startDate",
        MAX(date) as "endDate"
      FROM vercel_daily_summary
    `

    const row = result[0]
    if (!row?.startDate || !row?.endDate) return null

    return {
      startDate: row.startDate,
      endDate: row.endDate,
    }
  } catch (error) {
    console.error("Error getting historical data range:", error)
    return null
  }
}

import { getGA4StartDate } from "./analytics-config"
import { hasHistoricalData } from "./vercel-analytics-db"

// Determine if we should use historical data for a date range
export async function shouldUseHistoricalData(startDate: string, endDate: string): Promise<boolean> {
  const ga4StartDate = getGA4StartDate()

  // If the entire date range is before GA4 start date, use historical data
  if (new Date(endDate) < new Date(ga4StartDate)) {
    return true
  }

  // If the date range spans both periods, check if we have historical data
  if (new Date(startDate) < new Date(ga4StartDate) && new Date(endDate) >= new Date(ga4StartDate)) {
    return await hasHistoricalData(startDate, endDate)
  }

  // Otherwise use GA4 data
  return false
}

// Determine data source strategy for a date range
export async function getDataSourceStrategy(
  startDate: string,
  endDate: string,
): Promise<{
  useHistorical: boolean
  useGA4: boolean
  historicalStart?: string
  historicalEnd?: string
  ga4Start?: string
  ga4End?: string
  strategy: "historical-only" | "ga4-only" | "hybrid" | "no-data"
}> {
  const ga4StartDate = new Date(getGA4StartDate())
  const requestStart = parseRelativeDate(startDate)
  const requestEnd = parseRelativeDate(endDate)

  // Check if we have historical data
  const hasHistorical = await hasHistoricalData(
    requestStart.toISOString().split("T")[0],
    requestEnd.toISOString().split("T")[0],
  )

  // Determine strategy
  if (requestEnd < ga4StartDate) {
    // Entire range is before GA4 start
    return {
      useHistorical: hasHistorical,
      useGA4: false,
      historicalStart: hasHistorical ? requestStart.toISOString().split("T")[0] : undefined,
      historicalEnd: hasHistorical ? requestEnd.toISOString().split("T")[0] : undefined,
      strategy: hasHistorical ? "historical-only" : "no-data",
    }
  } else if (requestStart >= ga4StartDate) {
    // Entire range is after GA4 start
    return {
      useHistorical: false,
      useGA4: true,
      ga4Start: startDate,
      ga4End: endDate,
      strategy: "ga4-only",
    }
  } else {
    // Range spans both periods
    const ga4StartFormatted = ga4StartDate.toISOString().split("T")[0]
    const historicalEndDate = new Date(ga4StartDate)
    historicalEndDate.setDate(historicalEndDate.getDate() - 1)

    return {
      useHistorical: hasHistorical,
      useGA4: true,
      historicalStart: hasHistorical ? requestStart.toISOString().split("T")[0] : undefined,
      historicalEnd: hasHistorical ? historicalEndDate.toISOString().split("T")[0] : undefined,
      ga4Start: ga4StartFormatted,
      ga4End: endDate,
      strategy: "hybrid",
    }
  }
}

// Convert relative date strings to actual dates
export function parseRelativeDate(dateString: string): Date {
  const today = new Date()

  switch (dateString) {
    case "today":
      return today
    case "yesterday":
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday
    case "7daysAgo":
      const sevenDays = new Date(today)
      sevenDays.setDate(sevenDays.getDate() - 7)
      return sevenDays
    case "30daysAgo":
      const thirtyDays = new Date(today)
      thirtyDays.setDate(thirtyDays.getDate() - 30)
      return thirtyDays
    case "90daysAgo":
      const ninetyDays = new Date(today)
      ninetyDays.setDate(ninetyDays.getDate() - 90)
      return ninetyDays
    default:
      // Assume it's a date string like "2024-01-01"
      return new Date(dateString)
  }
}

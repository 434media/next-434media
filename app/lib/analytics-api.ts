import type { AnalyticsResponse } from "../types/analytics-types"
import type { TimeRange } from "../components/dashboard/TimeRangeSelector"

// Enhanced mock data with more realistic values
const MOCK_DATA = {
  visitors: {
    value: 12458,
    change: 8.3,
    description: "Unique visitors in selected period",
  },
  views: {
    value: 45621,
    change: 12.7,
    description: "Total page views in selected period",
  },
  duration: {
    value: 124,
    change: -2.1,
    description: "Average time on site (seconds)",
  },
  "bounce-rate": {
    value: 42.7,
    change: -3.5,
    description: "Percentage of single-page sessions",
  },
  "click-rate": {
    value: 3.2,
    change: 5.8,
    description: "Average click-through rate",
  },
  "top-country": {
    value: "United States",
    change: 5.7,
    description: "28% of total traffic",
  },
  devices: {
    value: { desktop: 68, mobile: 32 },
    change: 1.2,
    description: "Desktop / Mobile split",
  },
  "views-chart": {
    data: Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.toISOString().split("T")[0],
        views: Math.floor(Math.random() * 2000) + 1000 + Math.sin(i / 7) * 500,
      }
    }),
  },
  "devices-chart": {
    desktop: 6800,
    mobile: 3200,
  },
  "top-pages": [
    { page: "/", views: 4521, change: 12.3 },
    { page: "/blog", views: 2341, change: 5.7 },
    { page: "/shop", views: 1893, change: -2.1 },
    { page: "/about", views: 1254, change: 8.9 },
    { page: "/contact", views: 987, change: 15.2 },
    { page: "/events", views: 756, change: 22.1 },
    { page: "/dashboard", views: 543, change: -5.3 },
    { page: "/privacy-policy", views: 321, change: 3.4 },
    { page: "/terms-of-service", views: 198, change: 1.2 },
    { page: "/sdoh", views: 156, change: 45.6 },
  ],
  countries: [
    { country: "United States", code: "🇺🇸", views: 5421, change: 7.2 },
    { country: "United Kingdom", code: "🇬🇧", views: 2341, change: 3.5 },
    { country: "Germany", code: "🇩🇪", views: 1893, change: -1.2 },
    { country: "Canada", code: "🇨🇦", views: 1254, change: 9.8 },
    { country: "Australia", code: "🇦🇺", views: 987, change: 2.3 },
    { country: "France", code: "🇫🇷", views: 876, change: 4.1 },
    { country: "Japan", code: "🇯🇵", views: 654, change: -0.8 },
    { country: "Brazil", code: "🇧🇷", views: 543, change: 12.5 },
    { country: "India", code: "🇮🇳", views: 432, change: 18.9 },
    { country: "Spain", code: "🇪🇸", views: 321, change: 6.7 },
  ],
  "operating-systems": [
    { name: "Windows", views: 4521, percentage: 42.3 },
    { name: "macOS", views: 3254, percentage: 30.5 },
    { name: "iOS", views: 1532, percentage: 14.3 },
    { name: "Android", views: 987, percentage: 9.2 },
    { name: "Linux", views: 321, percentage: 3.0 },
    { name: "Chrome OS", views: 76, percentage: 0.7 },
  ],
  browsers: [
    { name: "Chrome", views: 5842, percentage: 54.7 },
    { name: "Safari", views: 2341, percentage: 21.9 },
    { name: "Firefox", views: 1254, percentage: 11.7 },
    { name: "Edge", views: 876, percentage: 8.2 },
    { name: "Opera", views: 321, percentage: 3.0 },
    { name: "Other", views: 54, percentage: 0.5 },
  ],
  referrers: [
    { referrer: "Direct / None", views: 4521, change: 7.2 },
    { referrer: "Google", views: 2341, change: 12.5 },
    { referrer: "Twitter", views: 1254, change: -3.2 },
    { referrer: "LinkedIn", views: 987, change: 15.7 },
    { referrer: "Facebook", views: 654, change: -2.1 },
    { referrer: "GitHub", views: 432, change: 22.3 },
    { referrer: "Instagram", views: 321, change: 5.4 },
    { referrer: "YouTube", views: 198, change: 8.9 },
  ],
  performance: {
    avg: 0.87,
    p75: 1.2,
    p90: 1.8,
    p99: 2.7,
    change: -12.3,
  },
}

// Enhanced simulation with better error handling
const simulateFetch = async (data: any, endpoint: string): Promise<any> => {
  // Realistic delay based on data complexity
  const baseDelay = 300
  const complexityDelay = endpoint === "views-chart" ? 200 : 100
  const delay = baseDelay + Math.floor(Math.random() * complexityDelay)

  await new Promise((resolve) => setTimeout(resolve, delay))

  // Reduced error rate to 0.5% for better UX
  const shouldSimulateError = Math.random() < 0.005 && endpoint !== "visitors"

  if (shouldSimulateError) {
    throw new Error(`Network timeout while fetching ${endpoint} data`)
  }

  // Add some variation to the data based on time range
  return addTimeRangeVariation(data, endpoint)
}

// Add realistic variation based on time range
const addTimeRangeVariation = (data: any, endpoint: string) => {
  if (endpoint === "visitors" || endpoint === "views") {
    return {
      ...data,
      value: data.value + Math.floor(Math.random() * 1000) - 500,
      change: (Math.random() - 0.5) * 20,
    }
  }

  if (endpoint === "top-pages") {
    return data.map((page: any) => ({
      ...page,
      views: page.views + Math.floor(Math.random() * 200) - 100,
      change: (Math.random() - 0.5) * 30,
    }))
  }

  if (endpoint === "countries") {
    return data.map((country: any) => ({
      ...country,
      views: country.views + Math.floor(Math.random() * 100) - 50,
      change: (Math.random() - 0.5) * 25,
    }))
  }

  return data
}

class AnalyticsAPI {
  private adminKey: string | null = null
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 2 * 60 * 1000 // 2 minutes for better real-time feel

  setAdminKey(key: string) {
    this.adminKey = key
  }

  private getCacheKey(endpoint: string, since: string, until: string): string {
    return `${endpoint}-${since}-${until}`
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION
  }

  private async fetchAnalytics(endpoint: string, since: string, until: string): Promise<AnalyticsResponse> {
    if (!this.adminKey) {
      throw new Error("Admin authentication required")
    }

    // Check cache first
    const cacheKey = this.getCacheKey(endpoint, since, until)
    const cached = this.cache.get(cacheKey)

    if (cached && this.isValidCache(cached.timestamp)) {
      return { data: cached.data }
    }

    try {
      const params = new URLSearchParams({
        endpoint,
        since,
        until,
      })

      const response = await fetch(`/api/analytics?${params}`, {
        headers: {
          "x-admin-key": this.adminKey,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // Cache the result
      this.cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
      })

      return result
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error)
      throw error
    }
  }

  // Clear cache when needed
  clearCache() {
    this.cache.clear()
  }
}

export const analyticsAPI = new AnalyticsAPI()

// Enhanced function to fetch analytics data with better error handling
export const fetchAnalyticsData = async (endpoint: string, timeRange: string, retryCount = 0): Promise<any> => {
  const MAX_RETRIES = 2

  try {
    // Get mock data for the endpoint
    const mockData = MOCK_DATA[endpoint as keyof typeof MOCK_DATA]

    if (!mockData) {
      throw new Error(`No data available for endpoint: ${endpoint}`)
    }

    // Simulate API fetch with enhanced error handling
    return await simulateFetch(mockData, endpoint)
  } catch (error) {
    console.warn(`Attempt ${retryCount + 1} failed for ${endpoint}:`, error)

    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay))
      return fetchAnalyticsData(endpoint, timeRange, retryCount + 1)
    }

    // If all retries failed, return fallback data
    console.error(`All retries failed for ${endpoint}, using fallback data`)
    return getFallbackData(endpoint)
  }
}

// Fallback data for when API calls fail
const getFallbackData = (endpoint: string) => {
  const fallbackData: Record<string, any> = {
    visitors: { value: 0, change: 0, description: "Data temporarily unavailable" },
    views: { value: 0, change: 0, description: "Data temporarily unavailable" },
    duration: { value: 0, change: 0, description: "Data temporarily unavailable" },
    "top-country": { value: "Unknown", change: 0, description: "Data temporarily unavailable" },
    devices: { value: { desktop: 0, mobile: 0 }, change: 0, description: "Data temporarily unavailable" },
    "views-chart": { data: [] },
    "devices-chart": { desktop: 0, mobile: 0 },
    "top-pages": [],
    countries: [],
    "bounce-rate": { value: 0, change: 0, description: "Data temporarily unavailable" },
    "click-rate": { value: 0, change: 0, description: "Data temporarily unavailable" },
    "operating-systems": [],
    browsers: [],
    referrers: [],
    performance: { avg: 0, p75: 0, p90: 0, p99: 0, change: 0 },
  }

  return fallbackData[endpoint] || null
}

// Update the fetchAllAnalyticsData function to include the new endpoints
export const fetchAllAnalyticsData = async (timeRange: TimeRange) => {
  const endpoints = [
    "visitors",
    "views",
    "duration",
    "bounce-rate",
    "click-rate",
    "top-country",
    "devices",
    "views-chart",
    "devices-chart",
    "top-pages",
    "countries",
    "operating-systems",
    "browsers",
    "referrers",
    "performance",
  ]

  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled(endpoints.map((endpoint) => fetchAnalyticsData(endpoint, timeRange.value)))

  // Process results and handle failures
  const processedResults: Record<string, any> = {}

  results.forEach((result, index) => {
    const endpoint = endpoints[index]

    if (result.status === "fulfilled") {
      processedResults[endpoint] = result.value
    } else {
      console.warn(`Failed to fetch ${endpoint}:`, result.reason)
      processedResults[endpoint] = getFallbackData(endpoint)
    }
  })

  return processedResults
}

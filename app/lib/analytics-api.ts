import type { TimeRange } from "../components/dashboard/TimeRangeSelector"

class VercelAnalyticsAPI {
  private adminKey: string | null = null
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  setAdminKey(key: string) {
    this.adminKey = key
  }

  private getCacheKey(endpoint: string, since: string, until: string): string {
    return `${endpoint}-${since}-${until}`
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION
  }

  private async fetchFromAPI(endpoint: string, since: string, until: string, limit = "10"): Promise<any> {
    if (!this.adminKey) {
      throw new Error("Admin authentication required")
    }

    const cacheKey = this.getCacheKey(endpoint, since, until)
    const cached = this.cache.get(cacheKey)

    if (cached && this.isValidCache(cached.timestamp)) {
      console.log(`Cache hit for ${endpoint}`)
      return cached.data
    }

    const params = new URLSearchParams({
      endpoint,
      since,
      until,
      limit,
    })

    console.log(`Fetching ${endpoint} from Vercel Analytics API...`)

    const response = await fetch(`/api/analytics?${params}`, {
      headers: {
        "x-admin-key": this.adminKey,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch ${endpoint}`)
    }

    const result = await response.json()

    // Only cache successful responses that have data
    if (result && !result.error) {
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      })
    }

    return result
  }

  async getPageViews(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("views", since, until)
  }

  async getVisitors(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("visitors", since, until)
  }

  async getTopPages(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("pages", since, until, "20")
  }

  async getCountries(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("countries", since, until, "15")
  }

  async getDevices(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("devices", since, until)
  }

  async getBrowsers(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("browsers", since, until, "10")
  }

  async getOperatingSystems(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("operating-systems", since, until, "10")
  }

  async getReferrers(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("referrers", since, until, "15")
  }

  async getBounceRate(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("bounce-rate", since, until)
  }

  async getSessionDuration(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("duration", since, until)
  }

  async getPerformanceMetrics(since: string, until: string): Promise<any> {
    return this.fetchFromAPI("performance", since, until)
  }

  async getRealtimeVisitors(): Promise<any> {
    return this.fetchFromAPI("realtime", "1h", "0h")
  }

  clearCache() {
    this.cache.clear()
    console.log("Analytics cache cleared")
  }
}

export const analyticsAPI = new VercelAnalyticsAPI()

// Simplified function to fetch analytics data with proper error handling
export const fetchAnalyticsData = async (endpoint: string, timeRange: string, retryCount = 0): Promise<any> => {
  const MAX_RETRIES = 2

  try {
    // Convert timeRange to since/until format
    const since = timeRange
    const until = "0d"

    // Set admin key from session storage
    const adminKey = typeof window !== "undefined" ? sessionStorage.getItem("adminKey") : null
    if (adminKey) {
      analyticsAPI.setAdminKey(adminKey)
    }

    switch (endpoint) {
      case "views":
      case "views-chart":
        return await analyticsAPI.getPageViews(since, until)
      case "visitors":
        return await analyticsAPI.getVisitors(since, until)
      case "top-pages":
        return await analyticsAPI.getTopPages(since, until)
      case "countries":
        return await analyticsAPI.getCountries(since, until)
      case "devices":
      case "devices-chart":
        return await analyticsAPI.getDevices(since, until)
      case "browsers":
        return await analyticsAPI.getBrowsers(since, until)
      case "operating-systems":
        return await analyticsAPI.getOperatingSystems(since, until)
      case "referrers":
        return await analyticsAPI.getReferrers(since, until)
      case "bounce-rate":
        return await analyticsAPI.getBounceRate(since, until)
      case "duration":
        return await analyticsAPI.getSessionDuration(since, until)
      case "performance":
        return await analyticsAPI.getPerformanceMetrics(since, until)
      case "realtime":
        return await analyticsAPI.getRealtimeVisitors()
      case "click-rate":
        // This would need to be implemented in Vercel Analytics API
        throw new Error("Click rate endpoint not available in Vercel Analytics")
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }
  } catch (error) {
    console.error(`Attempt ${retryCount + 1} failed for ${endpoint}:`, error)

    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      return fetchAnalyticsData(endpoint, timeRange, retryCount + 1)
    }

    // After all retries failed, throw the error
    throw error
  }
}

// Function to get all analytics data
export const fetchAllAnalyticsData = async (timeRange: TimeRange) => {
  const endpoints = [
    "views",
    "visitors",
    "top-pages",
    "countries",
    "devices",
    "browsers",
    "operating-systems",
    "referrers",
    "bounce-rate",
    "duration",
    "performance",
    "realtime",
  ]

  const results = await Promise.allSettled(endpoints.map((endpoint) => fetchAnalyticsData(endpoint, timeRange.value)))

  const processedResults: Record<string, any> = {}

  results.forEach((result, index) => {
    const endpoint = endpoints[index]

    if (result.status === "fulfilled") {
      processedResults[endpoint] = result.value
    } else {
      console.warn(`Failed to fetch ${endpoint}:`, result.reason)
      processedResults[endpoint] = {
        error: result.reason instanceof Error ? result.reason.message : "Failed to fetch data",
        endpoint,
      }
    }
  })

  return processedResults
}

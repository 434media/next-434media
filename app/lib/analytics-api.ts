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

    console.log(`Fetching ${endpoint} from API...`)

    const response = await fetch(`/api/analytics?${params}`, {
      headers: {
        "x-admin-key": this.adminKey,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()

    // Log if we're using mock data
    if (result._mock) {
      console.log(`Using ${result._fallback ? "fallback " : ""}mock data for ${endpoint}`)
    }

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

// Enhanced function to fetch analytics data with proper error handling and development mode support
export const fetchAnalyticsData = async (endpoint: string, timeRange: string, retryCount = 0): Promise<any> => {
  const MAX_RETRIES = 2

  try {
    const since = timeRange
    const until = "0d"

    // Set admin key from session storage
    const adminKey = typeof window !== "undefined" ? sessionStorage.getItem("adminKey") : null
    if (adminKey) {
      analyticsAPI.setAdminKey(adminKey)
    }

    let result: any

    switch (endpoint) {
      case "views":
      case "views-chart":
        result = await analyticsAPI.getPageViews(since, until)
        break
      case "visitors":
        result = await analyticsAPI.getVisitors(since, until)
        break
      case "pages":
      case "top-pages":
        result = await analyticsAPI.getTopPages(since, until)
        break
      case "countries":
        result = await analyticsAPI.getCountries(since, until)
        break
      case "devices":
      case "devices-chart":
        result = await analyticsAPI.getDevices(since, until)
        break
      case "browsers":
        result = await analyticsAPI.getBrowsers(since, until)
        break
      case "operating-systems":
        result = await analyticsAPI.getOperatingSystems(since, until)
        break
      case "referrers":
        result = await analyticsAPI.getReferrers(since, until)
        break
      case "bounce-rate":
        result = await analyticsAPI.getBounceRate(since, until)
        break
      case "duration":
        result = await analyticsAPI.getSessionDuration(since, until)
        break
      case "performance":
        result = await analyticsAPI.getPerformanceMetrics(since, until)
        break
      case "realtime":
        result = await analyticsAPI.getRealtimeVisitors()
        break
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`)
    }

    return result
  } catch (error) {
    console.error(`Attempt ${retryCount + 1} failed for ${endpoint}:`, error)

    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
      return fetchAnalyticsData(endpoint, timeRange, retryCount + 1)
    }

    throw error
  }
}

// Function to get all analytics data
export const fetchAllAnalyticsData = async (timeRange: TimeRange) => {
  const endpoints = [
    "views",
    "visitors",
    "pages",
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

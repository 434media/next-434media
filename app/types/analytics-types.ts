export interface TimeRange {
  label: string
  value: string
  since: string
  until: string
}

export interface ViewsData {
  total: number
  change: number
  data: Array<{
    date: string
    views: number
  }>
}

export interface PageData {
  page: string
  views: number
  change: number
}

export interface CountryData {
  country: string
  code: string
  views: number
  change: number
}

// Add the missing BounceRateData interface
export interface BounceRateData {
  rate: number
  change: number
  description?: string
}

// Update the DeviceData interface to match Vercel's structure
export interface DeviceData {
  desktop: number
  mobile: number
  // Remove tablet as Vercel Analytics only tracks desktop and mobile
}

// Add the missing PerformanceData interface
export interface PerformanceData {
  avg: number
  p75: number
  p90: number
  p99: number
  change: number
}

export interface BrowserData {
  name: string
  views: number
  percentage: number
}

export interface OSData {
  name: string
  views: number
  percentage: number
}

export interface ReferrerData {
  referrer: string
  views: number
  change: number
}

// Update the AnalyticsData interface to include all metrics
export interface AnalyticsData {
  views: ViewsData
  topPages: PageData[]
  countries: CountryData[]
  devices: DeviceData
  browsers: BrowserData[]
  operatingSystems: OSData[]
  referrers: ReferrerData[]
  bounceRate: BounceRateData
  performance: PerformanceData
}

export interface AnalyticsResponse {
  data: any[]
  total?: number
  change?: number
}

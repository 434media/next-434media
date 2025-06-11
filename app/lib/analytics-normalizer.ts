// Vercel Analytics field mappings to standardized names
const VERCEL_FIELD_MAPPINGS = {
  // Page views
  views: "pageViews",
  visitors: "users",
  unique_visitors: "newUsers",
  page_path: "path",
  page_title: "title",

  // Traffic sources / Referrers
  referrer: "source",
  referring_domain: "source",
  visits: "sessions",

  // Device data
  device_type: "deviceCategory",
  device_category: "deviceCategory",

  // Geographic data
  country_code: "country",
  city_name: "city",

  // Time data
  date: "date",
  timestamp: "date",
}

// Google Analytics 4 field mappings to standardized names
const GA4_FIELD_MAPPINGS = {
  screenPageViews: "pageViews",
  activeUsers: "users",
  newUsers: "newUsers",
  pagePath: "path",
  pageTitle: "title",
  sessionSource: "source",
  sessionMedium: "medium",
  sessions: "sessions",
  deviceCategory: "deviceCategory",
  country: "country",
  city: "city",
  date: "date",
}

// Normalize field names from different sources
export function normalizeFieldNames(data: any[], source: "vercel" | "ga4"): any[] {
  const mappings = source === "vercel" ? VERCEL_FIELD_MAPPINGS : GA4_FIELD_MAPPINGS

  return data.map((item) => {
    const normalized: any = {}

    Object.entries(item).forEach(([key, value]) => {
      const normalizedKey = mappings[key as keyof typeof mappings] || key
      normalized[normalizedKey] = value
    })

    return normalized
  })
}

// Clean and standardize referrer URLs from Vercel
export function normalizeVercelReferrers(referrers: any[]): any[] {
  return referrers.map((item) => {
    let source = item.referrer || item.source || item.referring_domain || ""

    // Clean up the referrer URL
    if (source) {
      // Remove protocol and www
      source = source.replace(/^https?:\/\//, "").replace(/^www\./, "")

      // Handle common URL shorteners and social media
      const domainMappings: { [key: string]: string } = {
        "t.co": "twitter.com",
        "fb.me": "facebook.com",
        "bit.ly": "bitly.com",
        "tinyurl.com": "tinyurl.com",
        "l.facebook.com": "facebook.com",
        "lm.facebook.com": "facebook.com",
      }

      // Check if it's a known domain mapping
      Object.entries(domainMappings).forEach(([short, full]) => {
        if (source.includes(short)) {
          source = full
        }
      })

      // Remove trailing paths for cleaner display
      source = source.split("/")[0]
    }

    return {
      ...item,
      source: source || "(direct)",
      sessions: item.sessions || item.visits || 0,
      users: item.users || item.visitors || 0,
      newUsers: item.newUsers || item.new_visitors || 0,
    }
  })
}

// Validate daily metrics data (data with dates)
export function validateDailyMetrics(data: any[]): { valid: any[]; issues: string[] } {
  const issues: string[] = []
  const valid: any[] = []

  data.forEach((item, index) => {
    const validItem = { ...item }
    let hasIssues = false

    // Validate date
    if (!item.date) {
      issues.push(`Row ${index}: Missing date`)
      hasIssues = true
    } else {
      const date = new Date(item.date)
      if (isNaN(date.getTime())) {
        issues.push(`Row ${index}: Invalid date format: ${item.date}`)
        hasIssues = true
      }
    }

    // Validate numeric fields
    const numericFields = ["pageViews", "sessions", "users", "newUsers"]
    numericFields.forEach((field) => {
      if (item[field] !== undefined) {
        const value = Number(item[field])
        if (isNaN(value) || value < 0) {
          issues.push(`Row ${index}: Invalid ${field}: ${item[field]}`)
          validItem[field] = 0
          hasIssues = true
        } else {
          validItem[field] = value
        }
      }
    })

    // Validate bounce rate (should be between 0 and 1)
    if (item.bounceRate !== undefined) {
      const bounceRate = Number(item.bounceRate)
      if (isNaN(bounceRate) || bounceRate < 0 || bounceRate > 1) {
        issues.push(`Row ${index}: Invalid bounce rate: ${item.bounceRate}`)
        validItem.bounceRate = 0
        hasIssues = true
      } else {
        validItem.bounceRate = bounceRate
      }
    }

    if (!hasIssues || validItem.date) {
      valid.push(validItem)
    }
  })

  return { valid, issues }
}

// Validate page views data
export function validatePageViewsData(data: any[]): { valid: any[]; issues: string[] } {
  const issues: string[] = []
  const valid: any[] = []

  data.forEach((item, index) => {
    const validItem = { ...item }
    let hasIssues = false

    // Validate path
    if (!item.path) {
      issues.push(`Row ${index}: Missing path`)
      hasIssues = true
    }

    // Validate numeric fields
    const numericFields = ["pageViews", "sessions"]
    numericFields.forEach((field) => {
      if (item[field] !== undefined) {
        const value = Number(item[field])
        if (isNaN(value) || value < 0) {
          issues.push(`Row ${index}: Invalid ${field}: ${item[field]}`)
          validItem[field] = 0
          hasIssues = true
        } else {
          validItem[field] = value
        }
      }
    })

    // Validate bounce rate (should be between 0 and 1)
    if (item.bounceRate !== undefined) {
      const bounceRate = Number(item.bounceRate)
      if (isNaN(bounceRate) || bounceRate < 0 || bounceRate > 1) {
        issues.push(`Row ${index}: Invalid bounce rate: ${item.bounceRate}`)
        validItem.bounceRate = 0
        hasIssues = true
      } else {
        validItem.bounceRate = bounceRate
      }
    }

    if (!hasIssues || validItem.path) {
      valid.push(validItem)
    }
  })

  return { valid, issues }
}

// Validate traffic sources/referrers data
export function validateTrafficSourcesData(data: any[]): { valid: any[]; issues: string[] } {
  const issues: string[] = []
  const valid: any[] = []

  data.forEach((item, index) => {
    const validItem = { ...item }
    let hasIssues = false

    // Validate source
    if (!item.source) {
      issues.push(`Row ${index}: Missing source`)
      validItem.source = "(direct)"
      hasIssues = true
    }

    // Validate medium
    if (!item.medium) {
      validItem.medium = "referral" // Default medium
    }

    // Validate numeric fields
    const numericFields = ["sessions", "users", "newUsers"]
    numericFields.forEach((field) => {
      if (item[field] !== undefined) {
        const value = Number(item[field])
        if (isNaN(value) || value < 0) {
          issues.push(`Row ${index}: Invalid ${field}: ${item[field]}`)
          validItem[field] = 0
          hasIssues = true
        } else {
          validItem[field] = value
        }
      }
    })

    valid.push(validItem)
  })

  return { valid, issues }
}

// Validate device data
export function validateDeviceData(data: any[]): { valid: any[]; issues: string[] } {
  const issues: string[] = []
  const valid: any[] = []

  const validDeviceCategories = ["desktop", "mobile", "tablet"]

  data.forEach((item, index) => {
    const validItem = { ...item }
    let hasIssues = false

    // Validate device category
    if (!item.deviceCategory) {
      issues.push(`Row ${index}: Missing deviceCategory`)
      hasIssues = true
    } else {
      const category = item.deviceCategory.toLowerCase()
      if (!validDeviceCategories.includes(category)) {
        issues.push(`Row ${index}: Invalid deviceCategory: ${item.deviceCategory}`)
        validItem.deviceCategory = "desktop" // Default
        hasIssues = true
      } else {
        validItem.deviceCategory = category
      }
    }

    // Validate numeric fields
    const numericFields = ["sessions", "users"]
    numericFields.forEach((field) => {
      if (item[field] !== undefined) {
        const value = Number(item[field])
        if (isNaN(value) || value < 0) {
          issues.push(`Row ${index}: Invalid ${field}: ${item[field]}`)
          validItem[field] = 0
          hasIssues = true
        } else {
          validItem[field] = value
        }
      }
    })

    if (!hasIssues || validItem.deviceCategory) {
      valid.push(validItem)
    }
  })

  return { valid, issues }
}

// Validate geographic data
export function validateGeographicData(data: any[]): { valid: any[]; issues: string[] } {
  const issues: string[] = []
  const valid: any[] = []

  data.forEach((item, index) => {
    const validItem = { ...item }
    let hasIssues = false

    // Validate country
    if (!item.country) {
      issues.push(`Row ${index}: Missing country`)
      hasIssues = true
    }

    // City is optional, but if present should be a string
    if (item.city && typeof item.city !== "string") {
      issues.push(`Row ${index}: Invalid city: ${item.city}`)
      validItem.city = ""
      hasIssues = true
    }

    // Validate numeric fields
    const numericFields = ["sessions", "users", "newUsers"]
    numericFields.forEach((field) => {
      if (item[field] !== undefined) {
        const value = Number(item[field])
        if (isNaN(value) || value < 0) {
          issues.push(`Row ${index}: Invalid ${field}: ${item[field]}`)
          validItem[field] = 0
          hasIssues = true
        } else {
          validItem[field] = value
        }
      }
    })

    if (!hasIssues || validItem.country) {
      valid.push(validItem)
    }
  })

  return { valid, issues }
}

// Legacy function for backward compatibility
export function validateNormalizedData(data: any[]): { valid: any[]; issues: string[] } {
  // Try to determine data type and use appropriate validator
  if (data.length === 0) {
    return { valid: [], issues: [] }
  }

  const firstItem = data[0]

  // Check if it's daily metrics data (has date)
  if (firstItem.date) {
    return validateDailyMetrics(data)
  }

  // Check if it's page views data (has path)
  if (firstItem.path) {
    return validatePageViewsData(data)
  }

  // Check if it's traffic sources data (has source)
  if (firstItem.source) {
    return validateTrafficSourcesData(data)
  }

  // Check if it's device data (has deviceCategory)
  if (firstItem.deviceCategory) {
    return validateDeviceData(data)
  }

  // Check if it's geographic data (has country)
  if (firstItem.country) {
    return validateGeographicData(data)
  }

  // Default to no validation if we can't determine the type
  return { valid: data, issues: [] }
}

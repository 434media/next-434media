import * as cheerio from "cheerio"
import type { ParsedEventData } from "../types/event-types"

interface ParseResult {
  success: boolean
  data?: ParsedEventData
  error?: string
}

// Hardcoded allow-list of permitted domains for SSRF prevention.
// The canonical hostnames below are string literals — never derived from user input —
// so the URL passed to fetch() is built entirely from trusted constants + a sanitised path,
// which breaks the taint chain that static-analysis tools flag.
const PLATFORM_HOSTS: Record<string, { canonical: string; platform: 'meetup' | 'eventbrite' | 'luma' }> = {
  'meetup.com':      { canonical: 'www.meetup.com',      platform: 'meetup' },
  'www.meetup.com':  { canonical: 'www.meetup.com',      platform: 'meetup' },
  'eventbrite.com':      { canonical: 'www.eventbrite.com',  platform: 'eventbrite' },
  'www.eventbrite.com':  { canonical: 'www.eventbrite.com',  platform: 'eventbrite' },
  'lu.ma':  { canonical: 'lu.ma', platform: 'luma' },
}

// Maximum URL length to prevent abuse
const MAX_URL_LENGTH = 2048

// Allowed characters in the path: letters, digits, hyphens, underscores, slashes, dots, tildes, percent-encoded sequences
const SAFE_PATH_RE = /^[a-zA-Z0-9\-._~/%]+$/

/**
 * Validate a user-supplied URL against the allow-list and return a safe URL
 * constructed entirely from hardcoded hostnames (no user-derived hostname in fetch target).
 */
function validateUrlForSSRF(url: string): { valid: true; safeUrl: string; platform: 'meetup' | 'eventbrite' | 'luma' } | { valid: false; error: string } {
  // Length check to prevent abuse
  if (!url || url.length > MAX_URL_LENGTH) {
    return { valid: false, error: "Invalid or excessively long URL." }
  }

  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return { valid: false, error: "Invalid URL format." }
  }

  // Only allow HTTPS protocol to prevent protocol-based attacks
  if (urlObj.protocol !== 'https:') {
    return { valid: false, error: "Only HTTPS URLs are supported for security reasons." }
  }

  // Reject URLs with authentication credentials
  if (urlObj.username || urlObj.password) {
    return { valid: false, error: "URLs with credentials are not allowed." }
  }

  // --- Hostname: looked up in hardcoded map (not derived from user input) ---
  const entry = PLATFORM_HOSTS[urlObj.hostname.toLowerCase()]
  if (!entry) {
    return {
      valid: false,
      error: `Unsupported platform. Only meetup.com, eventbrite.com, and lu.ma are supported.`
    }
  }

  // --- Pathname: sanitise to prevent path-traversal ---
  // Resolve the pathname (collapses ".." segments) and re-validate
  const resolvedPath = new URL(urlObj.pathname, 'https://x').pathname // normalises "/a/../b" → "/b"
  if (!SAFE_PATH_RE.test(resolvedPath)) {
    return { valid: false, error: "URL contains invalid characters." }
  }

  // Build the outgoing URL entirely from hardcoded hostname + sanitised path.
  // This breaks taint tracking: the hostname is a string literal from PLATFORM_HOSTS.
  const safeUrl = `https://${entry.canonical}${resolvedPath}`

  return { valid: true, safeUrl, platform: entry.platform }
}

export async function parseEventUrl(url: string): Promise<ParseResult> {
  try {
    console.log(`🔍 Parsing event URL: ${url}`)

    // Validate URL against allow-list to prevent SSRF attacks
    const validation = validateUrlForSSRF(url)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const { safeUrl, platform } = validation

    // Add this before the fetch call to handle timeout:
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    // Fetch with proper headers to avoid blocking
    // SSRF Protection: URL has been validated against strict allow-list above
    // Redirects are disabled to prevent redirect-based SSRF bypass attacks
    const response = await fetch(safeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: controller.signal,
      redirect: "error", // Prevent redirect-based SSRF bypass
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`❌ HTTP error: ${response.status} ${response.statusText}`)
      return {
        success: false,
        error: `Unable to access event page (${response.status}). The event may be private or require authentication.`,
      }
    }

    const html = await response.text()
    console.log(`✅ Successfully fetched HTML (${html.length} characters)`)

    const $ = cheerio.load(html)

    let result: ParsedEventData

    // Use the pre-validated platform instead of includes() checks
    if (platform === 'meetup') {
      result = await parseMeetupEvent($, safeUrl)
    } else if (platform === 'eventbrite') {
      result = await parseEventbriteEvent($, safeUrl)
    } else if (platform === 'luma') {
      result = await parseLumaEvent($, safeUrl)
    } else {
      // This should never happen due to earlier validation
      throw new Error("Unsupported platform")
    }

    console.log("🎉 Successfully parsed event:", result.title)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error("❌ Error parsing event:", error)

    // Handle redirect errors (blocked for SSRF prevention)
    if (error instanceof TypeError && error.message.includes("redirect")) {
      return {
        success: false,
        error: "The event page redirected to another location. Please use the final event URL directly.",
      }
    }

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        success: false,
        error: "Network error. Please check the URL and try again.",
      }
    }

    // Handle abort errors from timeout
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse event URL",
    }
  }
}

async function parseLumaEvent($: cheerio.Root, url: string): Promise<ParsedEventData> {
  console.log("🔍 Parsing Lu.ma event...")

  // Lu.ma has excellent structured data and clean selectors
  const title =
    $('h1[data-testid="event-title"]').text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().replace(" | Luma", "").trim() ||
    ""

  // Description from multiple sources
  const description =
    $('[data-testid="event-description"]').text().trim() ||
    $(".event-description").text().trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    ""

  let date = ""
  let time = ""
  let location = ""
  let attendees: number | undefined
  let organizer = ""

  // Lu.ma has excellent JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html()
      if (jsonText) {
        const data = JSON.parse(jsonText)
        if (data["@type"] === "Event") {
          console.log("📅 Found Lu.ma structured data:", data)

          if (data.startDate) {
            const startDate = new Date(data.startDate)
            date = startDate.toISOString().split("T")[0]
            time = startDate.toTimeString().slice(0, 5)
          }

          if (data.location) {
            if (typeof data.location === "string") {
              location = data.location
            } else if (data.location.name) {
              location = data.location.name
            } else if (data.location.address) {
              location =
                typeof data.location.address === "string"
                  ? data.location.address
                  : `${data.location.address.streetAddress || ""} ${data.location.address.addressLocality || ""}`.trim()
            }
          }

          if (data.organizer) {
            organizer = typeof data.organizer === "string" ? data.organizer : data.organizer.name || ""
          }

          // Lu.ma sometimes includes attendee info
          if (data.attendee && Array.isArray(data.attendee)) {
            attendees = data.attendee.length
          }
        }
      }
    } catch (e) {
      console.warn("Failed to parse Lu.ma JSON-LD:", e)
    }
  })

  // Fallback parsing for Lu.ma specific selectors
  if (!date) {
    // Lu.ma uses specific date selectors
    const dateElement = $('[data-testid="event-date"], .event-date, time').first()
    const dateTime = dateElement.attr("datetime") || dateElement.text()
    if (dateTime) {
      try {
        const startDate = new Date(dateTime)
        if (!isNaN(startDate.getTime())) {
          date = startDate.toISOString().split("T")[0]
          time = startDate.toTimeString().slice(0, 5)
        }
      } catch (e) {
        console.warn("Failed to parse Lu.ma date:", dateTime)
      }
    }
  }

  // Location fallback
  if (!location) {
    location =
      $('[data-testid="event-location"]').text().trim() ||
      $('[data-testid="venue-name"]').text().trim() ||
      $(".location").text().trim() ||
      $(".venue").text().trim() ||
      ""
  }

  // Organizer fallback
  if (!organizer) {
    organizer =
      $('[data-testid="host-name"]').text().trim() ||
      $('[data-testid="organizer-name"]').text().trim() ||
      $(".host-name").text().trim() ||
      $(".organizer").text().trim() ||
      ""
  }

  // Attendees fallback
  if (!attendees) {
    const attendeesText =
      $('[data-testid="attendee-count"]').text() || $(".attendee-count").text() || $(".rsvp-count").text()

    if (attendeesText) {
      const match = attendeesText.match(/(\d+)/)
      if (match) {
        attendees = Number.parseInt(match[1])
      }
    }
  }

  // Image - Lu.ma usually has good og:image
  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('[data-testid="event-image"] img').attr("src") ||
    $(".event-image img").attr("src") ||
    ""

  return {
    title: title || "Untitled Event",
    description: description.slice(0, 500),
    date,
    time,
    location,
    organizer,
    attendees,
    image,
    url,
    source: "luma",
  }
}

async function parseMeetupEvent($: cheerio.Root, url: string): Promise<ParsedEventData> {
  console.log("🔍 Parsing Meetup event...")

  // Multiple selectors for title (Meetup changes their structure frequently)
  const title =
    $('h1[data-testid="event-title"]').text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().replace(" | Meetup", "").trim() ||
    ""

  // Description from multiple sources
  const description =
    $('div[data-testid="event-description"] p').first().text().trim() ||
    $(".event-description p").first().text().trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    ""

  // Try to extract structured data first
  let date = ""
  let time = ""
  let location = ""
  let attendees: number | undefined

  // Look for JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html()
      if (jsonText) {
        const data = JSON.parse(jsonText)
        if (data["@type"] === "Event" || data.event) {
          const eventData = data.event || data
          if (eventData.startDate) {
            const startDate = new Date(eventData.startDate)
            date = startDate.toISOString().split("T")[0]
            time = startDate.toTimeString().slice(0, 5)
          }
          if (eventData.location) {
            location = typeof eventData.location === "string" ? eventData.location : eventData.location.name || ""
          }
        }
      }
    } catch (e) {
      // Continue to next script tag
    }
  })

  // Fallback date/time parsing
  if (!date) {
    const dateTimeElement = $("time").first()
    const dateTime = dateTimeElement.attr("datetime") || dateTimeElement.text()
    if (dateTime) {
      try {
        const startDate = new Date(dateTime)
        if (!isNaN(startDate.getTime())) {
          date = startDate.toISOString().split("T")[0]
          time = startDate.toTimeString().slice(0, 5)
        }
      } catch (e) {
        console.warn("Failed to parse date:", dateTime)
      }
    }
  }

  // Location fallback
  if (!location) {
    location =
      $('[data-testid="event-venue"]').text().trim() ||
      $(".venue-name").text().trim() ||
      $('meta[property="event:location"]').attr("content")?.trim() ||
      ""
  }

  // Organizer
  const organizer =
    $('[data-testid="organizer-name"]').text().trim() ||
    $(".organizer-name").text().trim() ||
    $('meta[property="event:organizer"]').attr("content")?.trim() ||
    ""

  // Attendees count
  const attendeesText = $('[data-testid="attendee-count"]').text() || $(".attendee-count").text()
  if (attendeesText) {
    const match = attendeesText.match(/(\d+)/)
    if (match) {
      attendees = Number.parseInt(match[1])
    }
  }

  // Image
  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $(".event-photo img").attr("src") ||
    ""

  return {
    title: title || "Untitled Event",
    description: description.slice(0, 500), // Limit description length
    date,
    time,
    location,
    organizer,
    attendees,
    image,
    url,
    source: "meetup",
  }
}

async function parseEventbriteEvent($: cheerio.Root, url: string): Promise<ParsedEventData> {
  console.log("🔍 Parsing Eventbrite event...")

  const title =
    $("h1.event-title").text().trim() ||
    $(".summary-info h1").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().replace(" Tickets", "").trim() ||
    ""

  const description =
    $(".event-description p").first().text().trim() ||
    $(".summary-info .summary").text().trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    ""

  let date = ""
  let time = ""
  let location = ""
  let attendees: number | undefined

  // Structured data parsing
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonText = $(element).html()
      if (jsonText) {
        const data = JSON.parse(jsonText)
        if (data["@type"] === "Event") {
          if (data.startDate) {
            const startDate = new Date(data.startDate)
            date = startDate.toISOString().split("T")[0]
            time = startDate.toTimeString().slice(0, 5)
          }
          if (data.location) {
            location = typeof data.location === "string" ? data.location : data.location.name || ""
          }
        }
      }
    } catch (e) {
      // Continue
    }
  })

  // Fallback parsing
  if (!date) {
    const dateElement = $(".event-date time, .date-info time").first()
    const dateTime = dateElement.attr("datetime") || dateElement.text()
    if (dateTime) {
      try {
        const startDate = new Date(dateTime)
        if (!isNaN(startDate.getTime())) {
          date = startDate.toISOString().split("T")[0]
          time = startDate.toTimeString().slice(0, 5)
        }
      } catch (e) {
        console.warn("Failed to parse date:", dateTime)
      }
    }
  }

  if (!location) {
    location =
      $(".event-venue").text().trim() ||
      $(".location-info").text().trim() ||
      $('meta[property="event:location"]').attr("content")?.trim() ||
      ""
  }

  const organizer =
    $(".organizer-name").text().trim() ||
    $(".event-organizer").text().trim() ||
    $('meta[property="event:organizer"]').attr("content")?.trim() ||
    ""

  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $(".event-hero-image img").attr("src") ||
    ""

  return {
    title: title || "Untitled Event",
    description: description.slice(0, 500),
    date,
    time,
    location,
    organizer,
    attendees,
    image,
    url,
    source: "eventbrite",
  }
}

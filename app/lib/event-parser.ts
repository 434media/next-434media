import * as cheerio from "cheerio"
import type { ParsedEventData } from "../types/event-types"

interface ParseResult {
  success: boolean
  data?: ParsedEventData
  error?: string
}

export async function parseEventUrl(url: string): Promise<ParseResult> {
  try {
    console.log(`🔍 Parsing event URL: ${url}`)

    // Validate URL
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Check supported platforms
    if (!hostname.includes("meetup.com") && !hostname.includes("eventbrite.com") && !hostname.includes("lu.ma")) {
      return {
        success: false,
        error: "Unsupported platform. Currently supports Meetup.com, Eventbrite.com, and Lu.ma",
      }
    }

    // Add this before the fetch call to handle timeout:
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    // Fetch with proper headers to avoid blocking
    const response = await fetch(url, {
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

    if (hostname.includes("meetup.com")) {
      result = await parseMeetupEvent($, url)
    } else if (hostname.includes("eventbrite.com")) {
      result = await parseEventbriteEvent($, url)
    } else if (hostname.includes("lu.ma")) {
      result = await parseLumaEvent($, url)
    } else {
      throw new Error("Unsupported platform")
    }

    console.log("🎉 Successfully parsed event:", result.title)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error("❌ Error parsing event:", error)

    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        success: false,
        error: "Network error. Please check the URL and try again.",
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

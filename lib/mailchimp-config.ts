import type { MailchimpConnectionStatus, MailchimpProperty } from "../types/mailchimp-analytics"

export interface MailchimpConfig {
  apiKey: string
  serverPrefix: string
  defaultListId?: string
}

// Property configurations for the two actual Mailchimp audiences
const MAILCHIMP_PROPERTIES: MailchimpProperty[] = [
  {
    id: "434media",
    name: "434 Media",
    key: "MAILCHIMP_AUDIENCE_ID_434MEDIA",
    list_id: "",
    member_count: 0,
    campaign_count: 0,
    created_date: null,
  },
  {
    id: "txmx",
    name: "TXMX Founders Tee",
    key: "MAILCHIMP_AUDIENCE_ID_TXMX",
    list_id: "",
    member_count: 0,
    campaign_count: 0,
    created_date: null,
  },
]

export function getMailchimpConfig(): MailchimpConfig | null {
  const apiKey = process.env.MAILCHIMP_API_KEY

  if (!apiKey) {
    return null
  }

  // Extract server prefix from API key (e.g., "us1" from "key-us1")
  const serverPrefix = apiKey.split("-").pop() || "us1"

  return {
    apiKey,
    serverPrefix,
    defaultListId: getDefaultAudienceId(),
  }
}

// Get default audience ID with fallback logic
export function getDefaultAudienceId(): string | undefined {
  // Prefer 434 Media, fallback to TXMX
  const primary = process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA
  const fallback = process.env.MAILCHIMP_AUDIENCE_ID_TXMX

  console.log("[Mailchimp Config] Checking audience IDs:", {
    primary: primary ? "configured" : "missing",
    fallback: fallback ? "configured" : "missing",
  })

  return primary || fallback
}

// Get all available properties with configuration status
export function getAvailableMailchimpProperties(): MailchimpProperty[] {
  return MAILCHIMP_PROPERTIES.map((property) => ({
    ...property,
    isConfigured: !!process.env[property.key],
  }))
}

// Get property by ID
export function getPropertyById(id: string): MailchimpProperty | undefined {
  return MAILCHIMP_PROPERTIES.find((prop) => prop.id === id)
}

// Get property name by audience ID
export function getPropertyNameByAudienceId(audienceId: string): string {
  const property434 = process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA
  const propertyTXMX = process.env.MAILCHIMP_AUDIENCE_ID_TXMX

  if (audienceId === property434) return "434 Media"
  if (audienceId === propertyTXMX) return "TXMX Founders Tee"

  return "Unknown Audience"
}

// Validate Mailchimp configuration
export function validateMailchimpConfig(): MailchimpConnectionStatus {
  const missingVariables: string[] = []
  const configuredProperties: MailchimpProperty[] = []

  // Check API key
  if (!process.env.MAILCHIMP_API_KEY) {
    missingVariables.push("MAILCHIMP_API_KEY")
  }

  // Check audience IDs
  for (const property of MAILCHIMP_PROPERTIES) {
    if (process.env[property.key]) {
      configuredProperties.push({
        ...property,
        isConfigured: true,
      })
    }
  }

  // Need at least one audience configured
  if (configuredProperties.length === 0) {
    missingVariables.push("At least one audience ID (MAILCHIMP_AUDIENCE_ID_434MEDIA or MAILCHIMP_AUDIENCE_ID_TXMX)")
  }

  const isValid = missingVariables.length === 0

  return {
    configured: isValid,
    connected: false, // Will be determined by actual API call
    validation: {
      hasApiKey: !!process.env.MAILCHIMP_API_KEY,
      hasServerPrefix: !!process.env.MAILCHIMP_API_KEY?.split("-")[1],
      hasListIds: configuredProperties.length > 0,
      missingVariables,
      configuredProperties,
    },
    availableProperties: getAvailableMailchimpProperties(),
    defaultListId: getDefaultAudienceId(),
  }
}

// Check if Mailchimp is configured
export function isMailchimpConfigured(): boolean {
  const hasApiKey = !!process.env.MAILCHIMP_API_KEY
  const hasAudienceId = !!(process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID_TXMX)

  console.log("[Mailchimp Config] Configuration status:", {
    hasApiKey,
    hasAudienceId,
    isConfigured: hasApiKey && hasAudienceId,
  })

  return hasApiKey && hasAudienceId
}

// Get server prefix from API key
export function getServerPrefix(): string | null {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) return null

  const parts = apiKey.split("-")
  return parts.length > 1 ? parts[1] : null
}

export function getMailchimpApiUrl(endpoint: string, serverPrefix: string): string {
  return `https://${serverPrefix}.api.mailchimp.com/3.0/${endpoint}`
}

export function getMailchimpHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

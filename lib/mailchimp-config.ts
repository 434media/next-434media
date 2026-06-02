import type { MailchimpConnectionStatus, MailchimpProperty } from "../types/mailchimp-analytics"

export interface MailchimpConfig {
  apiKey: string
  serverPrefix: string
  defaultListId?: string
}

// Property configuration for the single live Mailchimp audience. (The former
// TXMX audience was removed — its id 404s; TXMX now lives as brand:txmx tags
// within the 434 Media list. See docs/audiences-mailchimp-alignment.md.)
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

// Get the single 434 Media audience ID. Falls back to the legacy bare
// MAILCHIMP_AUDIENCE_ID alias (same list) so older env setups keep working.
export function getDefaultAudienceId(): string | undefined {
  return process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID
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
  const property434 = process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID

  if (audienceId === property434) return "434 Media"

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

  // Need the 434 Media audience configured
  if (configuredProperties.length === 0) {
    missingVariables.push("MAILCHIMP_AUDIENCE_ID_434MEDIA")
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
  const hasAudienceId = !!(process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID)

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

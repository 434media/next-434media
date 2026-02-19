import type { LinkedInConfigStatus } from "../types/linkedin-insights"

// LinkedIn API Configuration
export interface LinkedInAppConfig {
  clientId: string
  clientSecret?: string
  accessToken: string
  organizationId: string
  refreshToken?: string
  redirectUri?: string
  apiVersion: string
  scopes: string[]
}

// LinkedIn API Configuration from environment variables
export const linkedinConfig: LinkedInAppConfig = {
  clientId: process.env.LINKEDIN_CLIENT_ID || "",
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  accessToken: process.env.LINKEDIN_ACCESS_TOKEN || "",
  organizationId: process.env.LINKEDIN_ORGANIZATION_ID || "",
  refreshToken: process.env.LINKEDIN_REFRESH_TOKEN,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI,
  apiVersion: "202511", // LinkedIn API versioning format - November 2025
  scopes: [
    "r_organization_social", // Read organization posts
    "rw_organization_admin", // Read/write organization admin data
    "r_organization_followers", // Read follower demographics
    "w_organization_social", // Write organization posts (optional)
    "r_basicprofile", // Basic profile info
  ],
}

// Validate LinkedIn configuration
export function validateLinkedInConfig(): LinkedInConfigStatus {
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  // Required fields
  if (!linkedinConfig.clientId) missingRequired.push("LINKEDIN_CLIENT_ID")
  if (!linkedinConfig.accessToken) missingRequired.push("LINKEDIN_ACCESS_TOKEN")
  if (!linkedinConfig.organizationId) missingRequired.push("LINKEDIN_ORGANIZATION_ID")

  // Optional but recommended fields
  if (!linkedinConfig.clientSecret) missingOptional.push("LINKEDIN_CLIENT_SECRET")
  if (!linkedinConfig.refreshToken) missingOptional.push("LINKEDIN_REFRESH_TOKEN")
  if (!linkedinConfig.redirectUri) missingOptional.push("LINKEDIN_REDIRECT_URI")

  const configured = missingRequired.length === 0

  return {
    configured,
    missingRequired,
    missingOptional,
    hasAccessToken: !!linkedinConfig.accessToken,
    hasClientId: !!linkedinConfig.clientId,
    hasClientSecret: !!linkedinConfig.clientSecret,
    hasOrganizationId: !!linkedinConfig.organizationId,
    apiVersion: linkedinConfig.apiVersion,
  }
}

// Check if LinkedIn is properly configured
export function isLinkedInConfigured(): boolean {
  const status = validateLinkedInConfig()
  return status.configured
}

// Get LinkedIn configuration status for debugging
export function getLinkedInConfigurationStatus() {
  const status = validateLinkedInConfig()

  return {
    ...status,
    accessToken: linkedinConfig.accessToken
      ? `${linkedinConfig.accessToken.substring(0, 10)}...`
      : undefined,
    clientId: linkedinConfig.clientId,
    organizationId: linkedinConfig.organizationId
      ? `${linkedinConfig.organizationId.substring(0, 5)}...`
      : undefined,
    apiVersion: linkedinConfig.apiVersion,
    scopes: linkedinConfig.scopes,
    environmentVariables: {
      LINKEDIN_CLIENT_ID: !!process.env.LINKEDIN_CLIENT_ID,
      LINKEDIN_CLIENT_SECRET: !!process.env.LINKEDIN_CLIENT_SECRET,
      LINKEDIN_ACCESS_TOKEN: !!process.env.LINKEDIN_ACCESS_TOKEN,
      LINKEDIN_ORGANIZATION_ID: !!process.env.LINKEDIN_ORGANIZATION_ID,
      LINKEDIN_REFRESH_TOKEN: !!process.env.LINKEDIN_REFRESH_TOKEN,
      LINKEDIN_REDIRECT_URI: !!process.env.LINKEDIN_REDIRECT_URI,
    },
  }
}

// LinkedIn API Base URL - v2 is deprecated, use REST API
// See: https://learn.microsoft.com/en-us/linkedin/marketing/versioning
export const LINKEDIN_API_BASE_URL = "https://api.linkedin.com/rest"
export const LINKEDIN_REST_API_BASE_URL = "https://api.linkedin.com/rest"

// Helper to format organization URN
export function getOrganizationUrn(organizationId: string): string {
  return `urn:li:organization:${organizationId}`
}

// Helper to extract organization ID from URN
export function extractOrganizationId(urn: string): string {
  const match = urn.match(/urn:li:organization:(\d+)/)
  return match ? match[1] : urn
}

// Helper to format date for LinkedIn API (epoch milliseconds)
export function formatDateForLinkedIn(date: Date): number {
  return date.getTime()
}

// Helper to parse LinkedIn date (epoch milliseconds) to Date
export function parseLinkedInDate(timestamp: number): Date {
  return new Date(timestamp)
}

// Calculate date range for LinkedIn API queries
export function getLinkedInDateRange(range: "1d" | "7d" | "30d" | "90d" | "365d"): {
  startDate: number
  endDate: number
} {
  const now = new Date()
  const endDate = formatDateForLinkedIn(now)

  let startDate: number

  switch (range) {
    case "1d":
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 24 * 60 * 60 * 1000))
      break
    case "7d":
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      break
    case "30d":
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
      break
    case "90d":
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000))
      break
    case "365d":
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000))
      break
    default:
      startDate = formatDateForLinkedIn(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
  }

  return { startDate, endDate }
}

// LinkedIn API request headers (versioned API requires Linkedin-Version header)
export function getLinkedInHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": linkedinConfig.apiVersion, // Required for versioned APIs
  }
}

// OAuth 2.0 Authorization URL generator
export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: linkedinConfig.clientId,
    redirect_uri: linkedinConfig.redirectUri || "",
    state,
    scope: linkedinConfig.scopes.join(" "),
  })

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

// Token refresh helper (for server-side use)
export async function refreshLinkedInToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
  refresh_token?: string
} | null> {
  if (!linkedinConfig.clientId || !linkedinConfig.clientSecret) {
    console.error("[LinkedIn] Missing client credentials for token refresh")
    return null
  }

  try {
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: linkedinConfig.clientId,
        client_secret: linkedinConfig.clientSecret,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[LinkedIn] Token refresh failed:", error)
      return null
    }

    return response.json()
  } catch (error) {
    console.error("[LinkedIn] Token refresh error:", error)
    return null
  }
}

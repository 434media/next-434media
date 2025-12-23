import type { InstagramConfigStatus, InstagramAppConfig } from "../types/instagram-config"

// TXMX Boxing Instagram configuration
export const instagramConfig: InstagramAppConfig = {
  appId: process.env.INSTAGRAM_APP_ID || "",
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_TXMX || "",
  facebookPageId: process.env.FACEBOOK_PAGE_ID_TXMX || "",
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX,
  webhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  webhookSecret: process.env.INSTAGRAM_WEBHOOK_SECRET,
  apiVersion: "v23.0",
  scopes: [
    "instagram_basic",
    "instagram_manage_insights",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ],
}

// Vemos Vamos Instagram configuration (uses Vemos Vamos Insights App)
export const vemosInstagramConfig: InstagramAppConfig = {
  appId: process.env.INSTAGRAM_APP_ID_VEMOS || "",
  appSecret: process.env.INSTAGRAM_APP_SECRET,
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_VEMOS || "",
  facebookPageId: process.env.FACEBOOK_PAGE_ID_VEMOS || "",
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_VEMOS,
  webhookVerifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  webhookSecret: process.env.INSTAGRAM_WEBHOOK_SECRET,
  apiVersion: "v23.0",
  scopes: [
    "instagram_basic",
    "instagram_manage_insights",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
  ],
}

// Get Instagram config for a specific account
export function getInstagramConfigForAccount(accountId: string): InstagramAppConfig {
  switch (accountId) {
    case "vemos":
      return vemosInstagramConfig
    case "txmx":
    default:
      return instagramConfig
  }
}

// Validate TXMX Instagram configuration
export function validateInstagramConfig(): InstagramConfigStatus {
  const missingRequired: string[] = []
  const missingOptional: string[] = []

  // Required fields
  if (!instagramConfig.appId) missingRequired.push("INSTAGRAM_APP_ID")
  if (!instagramConfig.accessToken) missingRequired.push("INSTAGRAM_ACCESS_TOKEN_TXMX")
  if (!instagramConfig.facebookPageId) missingRequired.push("FACEBOOK_PAGE_ID_TXMX")

  // Optional but recommended fields
  if (!instagramConfig.appSecret) missingOptional.push("INSTAGRAM_APP_SECRET")
  if (!instagramConfig.businessAccountId) missingOptional.push("INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX")
  if (!instagramConfig.webhookVerifyToken) missingOptional.push("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")
  if (!instagramConfig.webhookSecret) missingOptional.push("INSTAGRAM_WEBHOOK_SECRET")

  const configured = missingRequired.length === 0

  return {
    configured,
    missingRequired,
    missingOptional,
    hasAccessToken: !!instagramConfig.accessToken,
    hasAppId: !!instagramConfig.appId,
    hasFacebookPageId: !!instagramConfig.facebookPageId,
    hasBusinessAccountId: !!instagramConfig.businessAccountId,
    hasAppSecret: !!instagramConfig.appSecret,
    hasWebhookConfig: !!(instagramConfig.webhookVerifyToken && instagramConfig.webhookSecret),
    apiVersion: instagramConfig.apiVersion,
    availableScopes: instagramConfig.scopes,
  }
}

// Check if Instagram is properly configured for TXMX
export function isInstagramConfigured(): boolean {
  const status = validateInstagramConfig()
  return status.configured
}

// Get Instagram configuration status for debugging
export function getInstagramConfigurationStatus() {
  const status = validateInstagramConfig()

  return {
    ...status,
    accessToken: instagramConfig.accessToken ? `${instagramConfig.accessToken.substring(0, 10)}...` : undefined,
    appId: instagramConfig.appId,
    facebookPageId: instagramConfig.facebookPageId ? `${instagramConfig.facebookPageId.substring(0, 8)}...` : undefined,
    businessAccountId: instagramConfig.businessAccountId
      ? `${instagramConfig.businessAccountId.substring(0, 8)}...`
      : undefined,
    environmentVariables: {
      INSTAGRAM_APP_ID: !!process.env.INSTAGRAM_APP_ID,
      INSTAGRAM_APP_SECRET: !!process.env.INSTAGRAM_APP_SECRET,
      INSTAGRAM_ACCESS_TOKEN_TXMX: !!process.env.INSTAGRAM_ACCESS_TOKEN_TXMX,
      FACEBOOK_PAGE_ID_TXMX: !!process.env.FACEBOOK_PAGE_ID_TXMX,
      INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX: !!process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX,
      INSTAGRAM_WEBHOOK_VERIFY_TOKEN: !!process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
      INSTAGRAM_WEBHOOK_SECRET: !!process.env.INSTAGRAM_WEBHOOK_SECRET,
    },
  }
}

// Default metrics for TXMX Instagram insights
export const DEFAULT_ACCOUNT_METRICS = [
  "impressions",
  "reach",
  "total_interactions",
  "profile_views",
  "website_clicks",
  "follower_count",
] as const

export const DEFAULT_MEDIA_METRICS = [
  "impressions",
  "reach",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
] as const

export const DEFAULT_VIDEO_METRICS = [
  "impressions",
  "reach",
  "total_interactions",
  "video_views",
  "likes",
  "comments",
  "shares",
  "saves",
] as const

// Time periods for insights
export const INSIGHT_PERIODS = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "days_28", label: "28 Days" },
] as const

// Date range presets for TXMX insights
export const DATE_RANGE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const

// Instagram API base URL
export const INSTAGRAM_API_BASE_URL = `https://graph.facebook.com/${instagramConfig.apiVersion}`

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  callsPerHour: 200,
  callsPerUserPerHour: 200,
  burstLimit: 50,
}

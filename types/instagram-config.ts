// Instagram Configuration Status for TXMX Boxing
export interface InstagramConfigStatus {
  configured: boolean
  missingRequired: string[]
  missingOptional: string[]
  hasAccessToken: boolean
  hasAppId: boolean
  hasFacebookPageId: boolean
  hasBusinessAccountId: boolean
  hasAppSecret: boolean
  hasWebhookConfig: boolean
  apiVersion: string
  availableScopes: readonly string[]
}

// Instagram App Configuration for TXMX Boxing
export interface InstagramAppConfig {
  appId: string
  appSecret?: string
  accessToken: string
  facebookPageId: string
  businessAccountId?: string
  webhookVerifyToken?: string
  webhookSecret?: string
  apiVersion: string
  scopes: string[]
}

// Rate Limit Configuration
export interface InstagramRateLimit {
  callsPerHour: number
  callsPerUserPerHour: number
  resetTime: Date
}

// Webhook Configuration
export interface InstagramWebhookConfig {
  verifyToken: string
  secret: string
  fields: string[]
  callbackUrl: string
}

// TXMX Boxing specific configuration
export interface TXMXInstagramConfig extends InstagramAppConfig {
  businessAccountId?: string
  username?: string
  isVerified?: boolean
}

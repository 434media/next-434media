// Mailchimp configuration types
export interface MailchimpConfig {
  apiKey: string
  serverPrefix: string
  defaultListId?: string
  lists: MailchimpProperty[]
}

export interface MailchimpListConfig {
  id: string
  name: string
  webId: number
  isDefault: boolean
  isActive: boolean
  memberCount: number
  campaignCount: number
  averageOpenRate: number
  averageClickRate: number
}

export interface MailchimpApiConfig {
  apiKey: string
  serverPrefix: string
  baseUrl: string
}

export interface MailchimpWebhookConfig {
  url: string
  events: {
    subscribe: boolean
    unsubscribe: boolean
    profile: boolean
    cleaned: boolean
    upemail: boolean
    campaign: boolean
  }
  sources: {
    user: boolean
    admin: boolean
    api: boolean
  }
}

// Environment variable configuration - updated for actual audiences
export interface MailchimpEnvironmentConfig {
  MAILCHIMP_API_KEY?: string
  MAILCHIMP_LIST_ID_434MEDIA?: string
  MAILCHIMP_LIST_ID_TXMX?: string
  MAILCHIMP_WEBHOOK_SECRET?: string
  ADMIN_PASSWORD?: string
}

// Rate limiting and API constraints
export interface MailchimpRateLimits {
  requestsPerSecond: number
  requestsPerHour: number
  requestsPerDay: number
  currentUsage: {
    requestsThisSecond: number
    requestsThisHour: number
    requestsThisDay: number
  }
}

export interface MailchimpApiConstraints {
  maxBatchSize: number
  maxCampaignsPerRequest: number
  maxMembersPerRequest: number
  maxReportsPerRequest: number
  rateLimits: MailchimpRateLimits
}

// Property configuration for the two actual audiences
export interface MailchimpProperty {
  id: string
  name: string
  envKey: string
  isConfigured?: boolean
}

export interface MailchimpConnectionStatus {
  success: boolean
  listId?: string
  listName?: string
  memberCount?: number
  apiKey?: string
  serverPrefix?: string
  error?: string
  availableProperties: MailchimpProperty[]
  defaultListId?: string
}

export interface MailchimpConfigurationStatus {
  configured: boolean
  missingVariables: string[]
  configuredProperties: MailchimpProperty[]
  missingProperties: string[]
  listId?: string
  serverPrefix?: string | null
  hasApiKey: boolean
  hasAdminPassword: boolean
  environmentVariables: {
    MAILCHIMP_API_KEY: boolean
    MAILCHIMP_LIST_ID_434MEDIA: boolean
    MAILCHIMP_LIST_ID_TXMX: boolean
    ADMIN_PASSWORD: boolean
  }
}

export interface MailchimpConnectionTest {
  success: boolean
  listId?: string
  listName?: string
  memberCount?: number
  error?: string
  timestamp: string
}

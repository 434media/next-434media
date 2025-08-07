import type { AnalyticsProperty, AnalyticsConnectionStatus } from "./analytics"

// Base property interface with key for environment variable mapping
export interface MailchimpProperty extends AnalyticsProperty {
  key: string // Environment variable key
  list_id: string
  member_count: number
  campaign_count: number
  created_date: string | null
}

// Extended connection status for Mailchimp
export interface MailchimpConnectionStatus extends AnalyticsConnectionStatus {
  apiKey?: string
  serverPrefix?: string
  listId?: string
  listName?: string
  memberCount?: number
  availableProperties?: MailchimpProperty[]
  defaultListId?: string
  validation?: {
    hasApiKey: boolean
    hasServerPrefix: boolean
    hasListIds: boolean
    missingVariables: string[]
    configuredProperties: MailchimpProperty[]
  }
}

export interface MailchimpAnalyticsSummary {
  totalSubscribers: number
  subscribersChange: number
  totalCampaigns: number
  campaignsChange: number
  totalEmailsSent: number
  emailsSentChange: number
  totalOpens: number
  opensChange: number
  totalClicks: number
  clicksChange: number
  averageOpenRate: number
  openRateChange: number
  averageClickRate: number
  clickRateChange: number
  unsubscribeRate: number
  unsubscribeRateChange: number
  averageBounceRate: number
  bounceRateChange: number
  totalRevenue: number
  revenueChange: number
  listId: string
  listName: string
  campaignCount: number
  lastCampaignDate: string | null
  _source: string
}

export interface MailchimpList {
  id: string
  web_id: number
  name: string
  contact: {
    company: string
    address1: string
    address2: string
    city: string
    state: string
    zip: string
    country: string
    phone: string
  }
  permission_reminder: string
  use_archive_bar: boolean
  campaign_defaults: {
    from_name: string
    from_email: string
    subject: string
    language: string
  }
  notify_on_subscribe: string
  notify_on_unsubscribe: string
  date_created: string
  list_rating: number
  email_type_option: boolean
  subscribe_url_short: string
  subscribe_url_long: string
  beamer_address: string
  visibility: string
  double_optin: boolean
  has_welcome: boolean
  marketing_permissions: boolean
  modules: string[]
  stats: {
    member_count: number
    unsubscribe_count: number
    cleaned_count: number
    member_count_since_send: number
    unsubscribe_count_since_send: number
    cleaned_count_since_send: number
    campaign_count: number
    campaign_last_sent: string
    merge_field_count: number
    avg_sub_rate: number
    avg_unsub_rate: number
    target_sub_rate: number
    open_rate: number
    click_rate: number
    last_sub_date: string
    last_unsub_date: string
  }
  _links: Array<{
    rel: string
    href: string
    method: string
    targetSchema: string
    schema: string
  }>
}

export interface MailchimpCampaign {
  id: string
  web_id: number
  type: string
  create_time: string
  archive_url: string
  long_archive_url: string
  status: string
  emails_sent: number
  send_time: string
  content_type: string
  needs_block_refresh: boolean
  resendable: boolean
  recipients: {
    list_id: string
    list_is_active: boolean
    list_name: string
    segment_text: string
    recipient_count: number
  }
  settings: {
    subject_line: string
    preview_text: string
    title: string
    from_name: string
    reply_to: string
    use_conversation: boolean
    to_name: string
    folder_id: string
    authenticate: boolean
    auto_footer: boolean
    inline_css: boolean
    auto_tweet: boolean
    fb_comments: boolean
    timewarp: boolean
    template_id: number
    drag_and_drop: boolean
  }
  tracking: {
    opens: boolean
    html_clicks: boolean
    text_clicks: boolean
    goal_tracking: boolean
    ecomm360: boolean
    google_analytics: string
    clicktale: string
  }
  report_summary: {
    opens: number
    unique_opens: number
    open_rate: number
    clicks: number
    subscriber_clicks: number
    click_rate: number
    emails_sent: number
    unsubscribed: number
    bounces: number
    forwards: number
    forward_opens: number
    ecommerce: {
      total_orders: number
      total_spent: number
      total_revenue: number
    }
  }
}

// Data interfaces for charts and components
export interface MailchimpEngagementData {
  campaignId: string
  campaignTitle: string
  sendTime: string
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  forwards: number
  forwardOpens: number
  openRate: number
  clickRate: number
}

export interface MailchimpCampaignPerformanceData {
  date: string
  campaignId: string
  campaignTitle: string
  emailsSent: number
  opens: number
  clicks: number
  unsubscribes: number
  bounces: number
  openRate: number
  clickRate: number
}

export interface MailchimpSubscriberGrowthData {
  date: string
  subscribes: number
  unsubscribes: number
  netGrowth: number
  totalSubscribers: number
}

export interface MailchimpGeographicData {
  country: string
  subscribers: number
  percentage: number
  opens: number
  clicks: number
  openRate: number
  clickRate: number
}

// Alias for backward compatibility
export interface MailchimpGeographicDataItem extends MailchimpGeographicData {}

export interface MailchimpRealtimeData {
  recentSubscribers: number
  recentOpens: number
  recentClicks: number
  recentCampaigns: number
  totalSubscribers: number
  listId: string
  listName: string
  _source: string
}

// Response interfaces
export interface MailchimpCampaignPerformanceResponse {
  data: MailchimpCampaignPerformanceData[]
  listId: string
  _source: string
}

export interface MailchimpSubscriberGrowthResponse {
  data: MailchimpSubscriberGrowthData[]
  listId: string
  _source: string
}

export interface MailchimpEngagementResponse {
  data: MailchimpEngagementData[]
  listId: string
  _source: string
}

export interface MailchimpGeographicResponse {
  data: MailchimpGeographicData[]
  listId: string
  _source: string
}

export interface MailchimpListsResponse {
  data: MailchimpList[]
  totalLists: number
  _source: string
}

export interface MailchimpCampaignsResponse {
  data: MailchimpCampaign[]
  totalCampaigns: number
  listId?: string
  _source: string
}

// API Response interfaces
export interface MailchimpApiResponse<T> {
  data: T
  success: boolean
  error?: string
}

export interface MailchimpConfigResponse {
  configured: boolean
  validation: {
    hasApiKey: boolean
    hasServerPrefix: boolean
    hasListIds: boolean
    missingVariables: string[]
    configuredProperties: string[]
  }
  timestamp: string
}

// Component prop types
export interface MailchimpMetricsProps {
  data: MailchimpAnalyticsSummary
}

export interface MailchimpChartProps {
  data: MailchimpCampaignPerformanceResponse | MailchimpEngagementResponse
}

export interface MailchimpTableProps {
  data: MailchimpCampaignsResponse
}

export interface MailchimpDateRangeProps {
  dateRange: {
    startDate: string
    endDate: string
  }
  onDateRangeChange: (range: { startDate: string; endDate: string }) => void
}

// Performance badge types
export type PerformanceLevel = "excellent" | "good" | "average" | "poor"

export interface PerformanceBadgeProps {
  value: number
  type: "open_rate" | "click_rate" | "unsubscribe_rate"
}

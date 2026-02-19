// Instagram Account Information
export interface InstagramAccount {
  id: string
  username: string
  name: string
  profile_picture_url: string
  followers_count: number
  follows_count: number
  media_count: number
  account_type: "BUSINESS" | "CREATOR" | "PERSONAL"
  biography: string
}

// Instagram Media Types
export interface InstagramMedia {
  id: string
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "STORY"
  media_url: string
  thumbnail_url?: string
  permalink: string
  caption: string
  timestamp: string
  username: string
  like_count: number
  comments_count: number
}

// Instagram Media Insights
export interface InstagramMediaInsights {
  mediaId: string
  impressions: number
  reach: number
  engagement: number
  likes: number
  comments: number
  shares: number
  saves: number
  videoViews: number
  _source: string
}

// Instagram Account Insights
export interface InstagramAccountInsights {
  accountId: string
  period: InstagramPeriod
  dateRange?: {
    since?: string
    until?: string
  }
  impressions: number
  reach: number
  profileViews: number
  websiteClicks: number
  emailContacts: number
  phoneCallClicks: number
  textMessageClicks: number
  getDirectionsClicks: number
  followerCount: number
  _source: string
}

// Instagram Audience Demographics
export interface InstagramAudienceInsights {
  account_id: string
  audience_gender_age: Array<{
    age_range: string
    gender: "M" | "F" | "U"
    value: number
  }>
  audience_locale: Array<{
    locale: string
    value: number
  }>
  audience_country: Array<{
    country: string
    value: number
  }>
  audience_city: Array<{
    city: string
    value: number
  }>
  online_followers: Array<{
    hour: number
    value: number
  }>
}

// Instagram Insights Data Structure
export interface InstagramInsight {
  name: string
  period: InstagramPeriod
  values: Array<{
    value: number
    end_time?: string
  }>
  title: string
  description: string
  id: string
}

// API Response Types
export interface InstagramInsightsResponse {
  data: Array<{
    date: string
    [key: string]: any
  }>
  accountId: string
  period: InstagramPeriod
  dateRange: {
    since?: string
    until?: string
  }
  _source: string
}

// Demographics Types
export interface InstagramDemographics {
  engaged_audience: {
    countries: Array<{ dimension: string; value: number }>
    cities: Array<{ dimension: string; value: number }>
    age_gender: Array<{ age: string; gender: string; value: number }>
  }
  follower_demographics?: {
    countries: Array<{ dimension: string; value: number }>
  } | null
}

// Online Followers (Best Time to Post)
export interface InstagramOnlineFollowers {
  hourly: Array<{ hour: number; count: number }>
  best_times: number[]
  timezone: string
}

// Reach Breakdown by Media Type
export interface InstagramReachBreakdown {
  FEED: number
  REELS: number
  STORY: number
  AD: number
}

export interface InstagramAccountResponse {
  data: InstagramAccount
  error?: {
    message: string
    type: string
    code: number
  }
}

// Dashboard Summary Types
export interface InstagramDashboardSummary {
  account: InstagramAccount
  insights: InstagramAccountInsights
  topMedia: Array<InstagramMedia & { insights: InstagramMediaInsights }>
  recentMedia: InstagramMedia[]
  growthMetrics: {
    followersGrowth: number
    impressionsGrowth: number
    reachGrowth: number
    engagementGrowth: number
  }
  timeSeriesData: InstagramInsightsResponse
}

// Time Series Data
export interface InstagramTimeSeriesData {
  date: string
  impressions: number
  reach: number
  profile_views: number
  website_clicks: number
  follower_count: number
}

// Configuration and Connection Status
export interface InstagramConnectionStatus {
  success: boolean
  accountId?: string
  username?: string
  accountType?: string
  followersCount?: number
  mediaCount?: number
  error?: string
  appId?: string
  hasAccessToken: boolean
  hasFacebookPageId: boolean
}

// Type definitions for API parameters
export type InstagramMetric =
  | "impressions"
  | "reach"
  | "profile_views"
  | "website_clicks"
  | "email_contacts"
  | "phone_call_clicks"
  | "text_message_clicks"
  | "get_directions_clicks"
  | "follower_count"

export type InstagramPeriod = "day" | "week" | "days_28" | "month" | "lifetime"

export type InstagramTimeRange = "1d" | "7d" | "30d" | "90d"

export type InstagramBreakdown = "age" | "city" | "country" | "gender" | "locale"

// Hashtag Performance
export interface InstagramHashtagInsights {
  hashtag: string
  impressions: number
  reach: number
  posts_count: number
}

// Story Insights
export interface InstagramStoryInsights {
  story_id: string
  impressions: number
  reach: number
  replies: number
  taps_forward: number
  taps_back: number
  exits: number
  completion_rate: number
}

// Webhook Types (for real-time updates)
export interface InstagramWebhookEvent {
  object: "instagram"
  entry: Array<{
    id: string
    time: number
    changes: Array<{
      field: string
      value: any
    }>
  }>
}

// API Request/Response Types
export interface InstagramAPIRequest {
  endpoint: string
  accountId?: string
  mediaId?: string
  metrics?: InstagramMetric[]
  period?: InstagramPeriod
  since?: string
  until?: string
  limit?: number
}

export interface InstagramAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  rateLimit?: {
    remaining: number
    resetTime: string
  }
}

// Error Types
export interface InstagramAPIError {
  code: number
  message: string
  type: string
  error_subcode?: number
  fbtrace_id?: string
}

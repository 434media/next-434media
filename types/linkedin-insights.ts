// LinkedIn Organization/Company Page Information
export interface LinkedInOrganization {
  id: string
  name: string
  vanityName: string
  localizedName: string
  logoUrl?: string
  coverPhotoUrl?: string
  description?: string
  websiteUrl?: string
  industry?: string
  staffCountRange?: string
  followersCount: number
  pageUrl: string
}

// LinkedIn Post/Share Types
export interface LinkedInPost {
  id: string
  author: string
  commentary?: string
  content?: {
    contentEntities?: Array<{
      entityLocation: string
      thumbnails?: Array<{ resolvedUrl: string }>
    }>
    title?: string
    description?: string
  }
  visibility: "PUBLIC" | "CONNECTIONS" | "LOGGED_IN"
  lifecycleState: "PUBLISHED" | "DRAFT"
  createdAt: string
  lastModifiedAt: string
  permalink?: string
  mediaType?: "NONE" | "IMAGE" | "VIDEO" | "ARTICLE" | "DOCUMENT"
}

// LinkedIn Post Analytics/Insights
export interface LinkedInPostInsights {
  postId: string
  impressions: number
  uniqueImpressions: number
  clicks: number
  likes: number
  comments: number
  shares: number
  engagement: number
  engagementRate: number
  videoViews?: number
  videoCompletions?: number
}

// LinkedIn Organization Analytics
export interface LinkedInOrganizationInsights {
  organizationId: string
  period: LinkedInPeriod
  dateRange?: {
    startDate: string
    endDate: string
  }
  // Page Statistics
  pageViews: number
  uniquePageViews: number
  allPageViews: number
  careersPageViews?: number
  jobsPageViews?: number
  
  // Follower Statistics
  totalFollowers: number
  organicFollowers: number
  paidFollowers: number
  followerGains: number
  followerLosses: number
  netFollowerChange: number
  
  // Engagement Statistics
  totalEngagements: number
  reactions: number
  comments: number
  shares: number
  clicks: number
  impressions: number
  
  // Visitor Statistics
  allDesktopPageViews?: number
  allMobilePageViews?: number
  
  _source: string
}

// LinkedIn Follower Demographics
export interface LinkedInFollowerDemographics {
  organizationId: string
  byFunction: Array<{
    function: string
    followerCounts: { organic: number; paid: number; total: number }
  }>
  bySeniority: Array<{
    seniority: string
    followerCounts: { organic: number; paid: number; total: number }
  }>
  byIndustry: Array<{
    industry: string
    followerCounts: { organic: number; paid: number; total: number }
  }>
  byLocation: Array<{
    location: string
    followerCounts: { organic: number; paid: number; total: number }
  }>
  byCompanySize: Array<{
    companySize: string
    followerCounts: { organic: number; paid: number; total: number }
  }>
}

// LinkedIn Visitor Demographics
export interface LinkedInVisitorDemographics {
  organizationId: string
  byFunction: Array<{
    function: string
    views: { desktop: number; mobile: number; total: number }
  }>
  bySeniority: Array<{
    seniority: string
    views: { desktop: number; mobile: number; total: number }
  }>
  byIndustry: Array<{
    industry: string
    views: { desktop: number; mobile: number; total: number }
  }>
  byLocation: Array<{
    location: string
    views: { desktop: number; mobile: number; total: number }
  }>
}

// Time Range Options
export type LinkedInTimeRange = "1d" | "7d" | "30d" | "90d" | "365d"
export type LinkedInPeriod = "day" | "month"

// API Response Types
export interface LinkedInInsightsResponse {
  data: Array<{
    date: string
    [key: string]: any
  }>
  organizationId: string
  period: LinkedInPeriod
  dateRange: {
    startDate: string
    endDate: string
  }
  _source: string
}

export interface LinkedInOrganizationResponse {
  data: LinkedInOrganization
  error?: {
    message: string
    status: number
    serviceErrorCode?: number
  }
}

export interface LinkedInPostsResponse {
  data: LinkedInPost[]
  paging?: {
    start: number
    count: number
    total: number
  }
  error?: {
    message: string
    status: number
  }
}

// Share Statistics (for post-level analytics)
export interface LinkedInShareStatistics {
  shareId: string
  totalShareStatistics: {
    shareCount: number
    clickCount: number
    engagement: number
    impressionCount: number
    likeCount: number
    commentCount: number
    uniqueImpressionsCount?: number
  }
  organizationalEntity: string
}

// Configuration Status
export interface LinkedInConfigStatus {
  configured: boolean
  missingRequired: string[]
  missingOptional: string[]
  hasAccessToken: boolean
  hasClientId: boolean
  hasClientSecret: boolean
  hasOrganizationId: boolean
  apiVersion: string
}

// LinkedIn Post with Insights combined
export type LinkedInPostWithInsights = LinkedInPost & {
  insights: LinkedInPostInsights
}

// Follower Statistics Time Series
export interface LinkedInFollowerStatistics {
  organizationId: string
  elements: Array<{
    timeRange: {
      start: number
      end: number
    }
    followerGains: {
      organicFollowerGain: number
      paidFollowerGain: number
    }
  }>
}

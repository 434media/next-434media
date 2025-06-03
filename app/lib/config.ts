"use client"

import { chartColors } from "./theme"

// Simplified configuration - dark theme only
export const config = {
  // Analytics chart colors
  views: {
    label: "Page Views",
    color: chartColors.primary,
  },
  visitors: {
    label: "Unique Visitors",
    color: chartColors.secondary,
  },
  bounceRate: {
    label: "Bounce Rate",
    color: chartColors.warning,
  },
  sessionDuration: {
    label: "Avg. Session Duration",
    color: chartColors.info,
  },

  // Device type colors
  desktop: {
    label: "Desktop",
    color: chartColors.chart1,
  },
  mobile: {
    label: "Mobile",
    color: chartColors.chart2,
  },
  tablet: {
    label: "Tablet",
    color: chartColors.chart3,
  },

  // Browser colors
  chrome: {
    label: "Chrome",
    color: chartColors.chart1,
  },
  firefox: {
    label: "Firefox",
    color: chartColors.chart2,
  },
  safari: {
    label: "Safari",
    color: chartColors.chart3,
  },
  edge: {
    label: "Edge",
    color: chartColors.chart4,
  },
  other: {
    label: "Other",
    color: chartColors.chart5,
  },

  // Status colors
  success: {
    label: "Success",
    color: chartColors.success,
  },
  error: {
    label: "Error",
    color: chartColors.danger,
  },
  warning: {
    label: "Warning",
    color: chartColors.warning,
  },
  info: {
    label: "Info",
    color: chartColors.info,
  },
}

// Application configuration
export const appConfig = {
  name: "434media Analytics",
  description: "Real-time analytics dashboard",
  version: "1.0.0",

  // Dashboard settings
  dashboard: {
    refreshInterval: 30000, // 30 seconds
    maxDataPoints: 100,
    defaultTimeRange: "7d",
    animationDuration: 300,
  },

  // Chart settings
  charts: {
    defaultHeight: 400,
    defaultWidth: "100%",
    animationDuration: 750,
    tooltipDelay: 0,
    gridOpacity: 0.1,
  },

  // Production Vercel Analytics configuration
  vercel: {
    // These will be used in production
    tokenEnvVar: "VERCEL_ANALYTICS_TOKEN",
    projectIdEnvVar: "VERCEL_PROJECT_ID",
    baseUrl: "https://vercel.com/api/web/insights",
    endpoints: {
      views: "views",
      visitors: "visitors",
      pages: "pages",
      referrers: "referrers",
      countries: "countries",
      devices: "devices",
      browsers: "browsers",
      os: "os",
    },
  },

  // API settings
  api: {
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },
}

export default config

import { NextResponse } from "next/server"
import { validateAnalyticsConfig, getConfigurationStatus } from "../../../lib/analytics-config"

export async function GET() {
  const configStatus = getConfigurationStatus()
  const isValid = validateAnalyticsConfig()

  return NextResponse.json({
    isValid,
    config: configStatus,
    environment: {
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
    },
    recommendations: [
      !configStatus.propertyId && "Set GA4_PROPERTY_ID environment variable",
      !configStatus.projectId && "Set GCP_PROJECT_ID environment variable",
      !configStatus.hasServiceAccountKey && "Set GA_SERVICE_ACCOUNT_KEY environment variable (JSON format)",
    ].filter(Boolean),
    debugInfo: {
      ga4PropertyId: configStatus.propertyId ? `${configStatus.propertyId.substring(0, 8)}...` : "missing",
      gcpProjectId: configStatus.projectId || "missing",
      hasServiceAccountKey: configStatus.hasServiceAccountKey,
      configuredProperties: configStatus.configuredProperties?.length || 0,
    },
  })
}

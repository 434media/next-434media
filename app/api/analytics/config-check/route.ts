import { NextResponse } from "next/server"
import { validateAnalyticsConfig, getConfigurationStatus, analyticsConfig } from "../../../lib/analytics-config"

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
      !configStatus.ga4PropertyId && "Set GA4_PROPERTY_ID environment variable",
      !configStatus.gcpProjectId && "Set GCP_PROJECT_ID environment variable",
      !configStatus.gcpServiceAccountEmail && "Set GCP_SERVICE_ACCOUNT_EMAIL environment variable",
      !configStatus.gcpWorkloadIdentityPoolId && "Set GCP_WORKLOAD_IDENTITY_POOL_ID environment variable",
      !configStatus.gcpWorkloadIdentityPoolProviderId &&
        "Set GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID environment variable",
      !configStatus.gcpProjectNumber && "Set GCP_PROJECT_NUMBER environment variable",
      !configStatus.hasAdminPassword && "Set ADMIN_PASSWORD environment variable",
    ].filter(Boolean),
    debugInfo: {
      ga4PropertyId: analyticsConfig.ga4PropertyId ? `${analyticsConfig.ga4PropertyId.substring(0, 8)}...` : "missing",
      gcpProjectId: analyticsConfig.gcpProjectId || "missing",
      serviceAccount: analyticsConfig.gcpServiceAccountEmail
        ? `${analyticsConfig.gcpServiceAccountEmail.split("@")[0]}@...`
        : "missing",
    },
  })
}

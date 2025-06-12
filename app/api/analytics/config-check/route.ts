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
      !configStatus.serviceAccount && "Set GCP_SERVICE_ACCOUNT_EMAIL environment variable",
      !configStatus.workloadIdentityPool && "Set GCP_WORKLOAD_IDENTITY_POOL_ID environment variable",
      !configStatus.workloadIdentityProvider && "Set GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID environment variable",
      !configStatus.projectNumber && "Set GCP_PROJECT_NUMBER environment variable",
      !configStatus.hasAdminPassword && "Set ADMIN_PASSWORD environment variable",
    ].filter(Boolean),
    debugInfo: {
      ga4PropertyId: configStatus.propertyId ? `${configStatus.propertyId.substring(0, 8)}...` : "missing",
      gcpProjectId: configStatus.projectId || "missing",
      gcpServiceAccountEmail: configStatus.serviceAccount
        ? `${configStatus.serviceAccount.split("@")[0]}@...`
        : "missing",
      gcpWorkloadIdentityPoolId: configStatus.workloadIdentityPool || "missing",
      gcpWorkloadIdentityPoolProviderId: configStatus.workloadIdentityProvider || "missing",
      gcpProjectNumber: configStatus.projectNumber || "missing",
    },
  })
}

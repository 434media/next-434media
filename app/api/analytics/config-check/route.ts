import { NextResponse } from "next/server"
import { getConfigurationStatus, getAuthenticationMethod } from "../../../lib/analytics-config"
import { testAnalyticsConnection } from "../../../lib/google-analytics"

export async function GET() {
  try {
    const configStatus = getConfigurationStatus()
    const authMethod = getAuthenticationMethod()
    const connectionTest = await testAnalyticsConnection()

    return NextResponse.json({
      ...configStatus,
      authMethod,
      connectionTest,
      environment: process.env.NODE_ENV,
      isVercelDeployment: !!process.env.VERCEL,
      timestamp: new Date().toISOString(),
      vercelOIDCSetup: {
        hasPoolId: !!process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
        hasProviderId: !!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
        hasServiceAccountEmail: !!process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        hasProjectNumber: !!process.env.GCP_PROJECT_NUMBER,
        hasProjectId: !!process.env.GCP_PROJECT_ID,
        poolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
        providerId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
        serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        projectNumber: process.env.GCP_PROJECT_NUMBER,
        projectId: process.env.GCP_PROJECT_ID,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check configuration",
        details: error instanceof Error ? error.message : "Unknown error",
        authMethod: getAuthenticationMethod(),
      },
      { status: 500 },
    )
  }
}

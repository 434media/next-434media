// Google Analytics 4 Configuration for Vercel OIDC
export const analyticsConfig = {
  // Google Analytics
  ga4PropertyId: process.env.GA4_PROPERTY_ID,

  // Google Cloud Project Configuration
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpProjectNumber: process.env.GCP_PROJECT_NUMBER,

  // Vercel OIDC Workload Identity Federation
  gcpWorkloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
  gcpWorkloadIdentityPoolProviderId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,
} as const

// Validation function for required environment variables
export function validateAnalyticsConfig(): boolean {
  const required = [
    analyticsConfig.ga4PropertyId,
    analyticsConfig.gcpProjectId,
    analyticsConfig.gcpProjectNumber,
    analyticsConfig.gcpWorkloadIdentityPoolId,
    analyticsConfig.gcpWorkloadIdentityPoolProviderId,
    analyticsConfig.gcpServiceAccountEmail,
    analyticsConfig.adminPassword,
  ]

  const missing = required.filter((value) => !value || value.trim() === "")

  if (missing.length > 0) {
    console.error("[Analytics Config] Missing required environment variables")
    return false
  }

  // Ensure we're in Vercel environment for OIDC
  if (!process.env.VERCEL) {
    console.error("[Analytics Config] Vercel OIDC requires deployment to Vercel")
    return false
  }

  return true
}

// Check if analytics is properly configured
export function isAnalyticsConfigured(): boolean {
  return validateAnalyticsConfig()
}

// Generate the Workload Identity Federation audience for Vercel OIDC
export function getWorkloadIdentityAudience(): string {
  if (
    !analyticsConfig.gcpProjectNumber ||
    !analyticsConfig.gcpWorkloadIdentityPoolId ||
    !analyticsConfig.gcpWorkloadIdentityPoolProviderId
  ) {
    throw new Error("Missing Workload Identity Federation configuration")
  }

  return `//iam.googleapis.com/projects/${analyticsConfig.gcpProjectNumber}/locations/global/workloadIdentityPools/${analyticsConfig.gcpWorkloadIdentityPoolId}/providers/${analyticsConfig.gcpWorkloadIdentityPoolProviderId}`
}

// Generate the service account impersonation URL
export function getServiceAccountImpersonationUrl(): string {
  if (!analyticsConfig.gcpServiceAccountEmail) {
    throw new Error("Missing service account email")
  }

  return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${analyticsConfig.gcpServiceAccountEmail}:generateAccessToken`
}

// Get configuration status for debugging
export function getConfigurationStatus() {
  return {
    configured: validateAnalyticsConfig(),
    propertyId: analyticsConfig.ga4PropertyId,
    projectId: analyticsConfig.gcpProjectId,
    projectNumber: analyticsConfig.gcpProjectNumber,
    serviceAccount: analyticsConfig.gcpServiceAccountEmail,
    workloadIdentityPool: analyticsConfig.gcpWorkloadIdentityPoolId,
    workloadIdentityProvider: analyticsConfig.gcpWorkloadIdentityPoolProviderId,
    isVercelDeployment: !!process.env.VERCEL,
    hasAdminPassword: !!analyticsConfig.adminPassword,
  }
}

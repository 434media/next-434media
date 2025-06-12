// Google Analytics 4 Configuration
export const analyticsConfig = {
  // Google Analytics
  ga4PropertyId: process.env.GA4_PROPERTY_ID,

  // Google Cloud Project Configuration
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpProjectNumber: process.env.GCP_PROJECT_NUMBER,

  // Workload Identity Federation
  gcpWorkloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
  gcpWorkloadIdentityPoolProviderId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,
} as const

// Get missing environment variables
export function getMissingEnvironmentVariables(): string[] {
  const missing = []

  if (!analyticsConfig.ga4PropertyId) missing.push("GA4_PROPERTY_ID")
  if (!analyticsConfig.gcpProjectId) missing.push("GCP_PROJECT_ID")
  if (!analyticsConfig.gcpProjectNumber) missing.push("GCP_PROJECT_NUMBER")
  if (!analyticsConfig.gcpWorkloadIdentityPoolId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
  if (!analyticsConfig.gcpWorkloadIdentityPoolProviderId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
  if (!analyticsConfig.gcpServiceAccountEmail) missing.push("GCP_SERVICE_ACCOUNT_EMAIL")
  if (!analyticsConfig.adminPassword) missing.push("ADMIN_PASSWORD")

  return missing
}

// Validation function for required environment variables
export function validateAnalyticsConfig(): boolean {
  const missing = getMissingEnvironmentVariables()

  if (missing.length > 0) {
    console.error("[Analytics Config] Missing required environment variables:", missing)
    return false
  }

  // Additional validation for format
  if (analyticsConfig.ga4PropertyId && !analyticsConfig.ga4PropertyId.match(/^\d+$/)) {
    console.error("[Analytics Config] GA4_PROPERTY_ID should be numeric")
    return false
  }

  if (analyticsConfig.gcpProjectNumber && !analyticsConfig.gcpProjectNumber.match(/^\d+$/)) {
    console.error("[Analytics Config] GCP_PROJECT_NUMBER should be numeric")
    return false
  }

  if (analyticsConfig.gcpServiceAccountEmail && !analyticsConfig.gcpServiceAccountEmail.includes("@")) {
    console.error("[Analytics Config] GCP_SERVICE_ACCOUNT_EMAIL should be a valid email")
    return false
  }

  return true
}

// Check if analytics is properly configured
export function isAnalyticsConfigured(): boolean {
  return validateAnalyticsConfig()
}

// Generate the Workload Identity Federation audience
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
  const missing = getMissingEnvironmentVariables()

  return {
    configured: validateAnalyticsConfig(),
    missingVariables: missing,
    propertyId: analyticsConfig.ga4PropertyId,
    projectId: analyticsConfig.gcpProjectId,
    projectNumber: analyticsConfig.gcpProjectNumber,
    serviceAccount: analyticsConfig.gcpServiceAccountEmail,
    workloadIdentityPool: analyticsConfig.gcpWorkloadIdentityPoolId,
    workloadIdentityProvider: analyticsConfig.gcpWorkloadIdentityPoolProviderId,
    hasAdminPassword: !!analyticsConfig.adminPassword,
    environmentVariables: {
      GA4_PROPERTY_ID: !!process.env.GA4_PROPERTY_ID,
      GCP_PROJECT_ID: !!process.env.GCP_PROJECT_ID,
      GCP_PROJECT_NUMBER: !!process.env.GCP_PROJECT_NUMBER,
      GCP_WORKLOAD_IDENTITY_POOL_ID: !!process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
      GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: !!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
      GCP_SERVICE_ACCOUNT_EMAIL: !!process.env.GCP_SERVICE_ACCOUNT_EMAIL,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    },
  }
}

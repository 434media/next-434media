// Vercel OIDC Workload Identity Federation configuration
export const analyticsConfig = {
  // Google Analytics
  ga4PropertyId: process.env.GA4_PROPERTY_ID,

  // Google Cloud Project Configuration
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpProjectNumber: process.env.GCP_PROJECT_NUMBER,

  // Workload Identity Federation (Vercel OIDC) - Required for production
  gcpWorkloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
  gcpWorkloadIdentityPoolProviderId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,

  // Historical data configuration
  ga4StartDate: process.env.GA4_START_DATE || "2024-01-01",
} as const

// Validation function for Vercel OIDC Workload Identity Federation
export function validateAnalyticsConfig() {
  const missing = []
  const isProduction = process.env.NODE_ENV === "production"
  const isVercelDeployment = !!process.env.VERCEL

  // Always required
  if (!analyticsConfig.ga4PropertyId) missing.push("GA4_PROPERTY_ID")
  if (!analyticsConfig.gcpProjectId) missing.push("GCP_PROJECT_ID")
  if (!analyticsConfig.adminPassword) missing.push("ADMIN_PASSWORD")

  // For production deployment, require OIDC variables
  if (isProduction) {
    if (!analyticsConfig.gcpProjectNumber) missing.push("GCP_PROJECT_NUMBER")
    if (!analyticsConfig.gcpWorkloadIdentityPoolId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
    if (!analyticsConfig.gcpWorkloadIdentityPoolProviderId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
    if (!analyticsConfig.gcpServiceAccountEmail) missing.push("GCP_SERVICE_ACCOUNT_EMAIL")
  }

  if (missing.length > 0) {
    console.error(`[Analytics] Missing required environment variables: ${missing.join(", ")}`)
    return false
  }

  return true
}

// Check if analytics is properly configured
export function isAnalyticsConfigured(): boolean {
  return validateAnalyticsConfig()
}

// Check if we're using Vercel OIDC Workload Identity Federation
export function isVercelOIDCConfigured(): boolean {
  return !!(
    process.env.VERCEL &&
    analyticsConfig.gcpWorkloadIdentityPoolId &&
    analyticsConfig.gcpWorkloadIdentityPoolProviderId &&
    analyticsConfig.gcpServiceAccountEmail &&
    analyticsConfig.gcpProjectNumber
  )
}

// Get the authentication method being used
export function getAuthenticationMethod(): "vercel-oidc" | "not-configured" {
  if (isVercelOIDCConfigured()) return "vercel-oidc"
  return "not-configured"
}

// Configuration validation with detailed feedback for Vercel OIDC
export function getConfigurationStatus() {
  const isVercelDeployment = !!process.env.VERCEL
  const isProduction = process.env.NODE_ENV === "production"
  const authMethod = getAuthenticationMethod()

  const status = {
    configured: false,
    authenticationMethod: authMethod,
    isVercelDeployment,
    isProduction,
    missingVariables: [] as string[],
    recommendations: [] as string[],
    oidcSetup: {
      poolId: analyticsConfig.gcpWorkloadIdentityPoolId,
      providerId: analyticsConfig.gcpWorkloadIdentityPoolProviderId,
      serviceAccountEmail: analyticsConfig.gcpServiceAccountEmail,
      projectNumber: analyticsConfig.gcpProjectNumber,
    },
  }

  // Check required variables
  if (!analyticsConfig.ga4PropertyId) status.missingVariables.push("GA4_PROPERTY_ID")
  if (!analyticsConfig.gcpProjectId) status.missingVariables.push("GCP_PROJECT_ID")
  if (!analyticsConfig.adminPassword) status.missingVariables.push("ADMIN_PASSWORD")

  // Check OIDC specific variables for production
  if (isProduction) {
    if (!analyticsConfig.gcpProjectNumber) status.missingVariables.push("GCP_PROJECT_NUMBER")
    if (!analyticsConfig.gcpWorkloadIdentityPoolId) status.missingVariables.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
    if (!analyticsConfig.gcpWorkloadIdentityPoolProviderId)
      status.missingVariables.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
    if (!analyticsConfig.gcpServiceAccountEmail) status.missingVariables.push("GCP_SERVICE_ACCOUNT_EMAIL")
  }

  status.configured = status.missingVariables.length === 0

  // Provide recommendations
  if (!status.configured) {
    if (isProduction) {
      status.recommendations.push("Configure Vercel OIDC Workload Identity Federation environment variables")
      status.recommendations.push("Ensure GCP Workload Identity Pool and Provider are properly set up")
      status.recommendations.push("Verify service account has Analytics Data API permissions")
    } else {
      status.recommendations.push("Development mode: Ensure all environment variables are set for testing")
    }
  }

  if (authMethod === "vercel-oidc") {
    status.recommendations.push("Using Vercel OIDC Workload Identity Federation (recommended)")
  } else {
    status.recommendations.push("OIDC not configured - set up Workload Identity Federation")
  }

  return status
}

// Generate the Workload Identity Federation audience for Vercel
export function getWorkloadIdentityAudience(): string | null {
  if (
    !analyticsConfig.gcpProjectNumber ||
    !analyticsConfig.gcpWorkloadIdentityPoolId ||
    !analyticsConfig.gcpWorkloadIdentityPoolProviderId
  ) {
    return null
  }

  return `//iam.googleapis.com/projects/${analyticsConfig.gcpProjectNumber}/locations/global/workloadIdentityPools/${analyticsConfig.gcpWorkloadIdentityPoolId}/providers/${analyticsConfig.gcpWorkloadIdentityPoolProviderId}`
}

// Generate the service account impersonation URL
export function getServiceAccountImpersonationUrl(): string | null {
  if (!analyticsConfig.gcpServiceAccountEmail) {
    return null
  }

  return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${analyticsConfig.gcpServiceAccountEmail}:generateAccessToken`
}

// Get GA4 start date for hybrid data logic
export function getGA4StartDate(): string {
  return analyticsConfig.ga4StartDate
}

// Vercel OIDC Workload Identity Federation configuration
export const analyticsConfig = {
  // Google Analytics
  ga4PropertyId: process.env.GA4_PROPERTY_ID,

  // Google Cloud Project Configuration
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpProjectNumber: process.env.GCP_PROJECT_NUMBER,

  // Workload Identity Federation (Vercel OIDC)
  gcpWorkloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
  gcpWorkloadIdentityPoolProviderId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,

  // Fallback for local development
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,
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

  // For Vercel production deployment, require OIDC variables
  if (isVercelDeployment && isProduction) {
    if (!analyticsConfig.gcpProjectNumber) missing.push("GCP_PROJECT_NUMBER")
    if (!analyticsConfig.gcpWorkloadIdentityPoolId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
    if (!analyticsConfig.gcpWorkloadIdentityPoolProviderId) missing.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
    if (!analyticsConfig.gcpServiceAccountEmail) missing.push("GCP_SERVICE_ACCOUNT_EMAIL")
  }

  // For local development, require service account file
  if (!isVercelDeployment && !analyticsConfig.googleApplicationCredentials) {
    missing.push("GOOGLE_APPLICATION_CREDENTIALS")
  }

  if (missing.length > 0) {
    console.warn(`[Analytics] Missing environment variables: ${missing.join(", ")}. Using mock data.`)
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

// Check if we're using local development with service account file
export function isLocalDevelopmentConfigured(): boolean {
  return !!(!process.env.VERCEL && analyticsConfig.googleApplicationCredentials)
}

// Get the authentication method being used
export function getAuthenticationMethod(): "vercel-oidc" | "service-account-file" | "not-configured" {
  if (isVercelOIDCConfigured()) return "vercel-oidc"
  if (isLocalDevelopmentConfigured()) return "service-account-file"
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

  // Check Vercel OIDC specific variables
  if (isVercelDeployment && isProduction) {
    if (!analyticsConfig.gcpProjectNumber) status.missingVariables.push("GCP_PROJECT_NUMBER")
    if (!analyticsConfig.gcpWorkloadIdentityPoolId) status.missingVariables.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
    if (!analyticsConfig.gcpWorkloadIdentityPoolProviderId)
      status.missingVariables.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
    if (!analyticsConfig.gcpServiceAccountEmail) status.missingVariables.push("GCP_SERVICE_ACCOUNT_EMAIL")
  }

  // Check local development variables
  if (!isVercelDeployment && !analyticsConfig.googleApplicationCredentials) {
    status.missingVariables.push("GOOGLE_APPLICATION_CREDENTIALS")
  }

  status.configured = status.missingVariables.length === 0

  // Provide recommendations
  if (!status.configured) {
    if (isVercelDeployment && isProduction) {
      status.recommendations.push("Configure Vercel OIDC Workload Identity Federation environment variables")
      status.recommendations.push("Ensure GCP Workload Identity Pool and Provider are properly set up")
      status.recommendations.push("Verify service account has Analytics Data API permissions")
    } else if (!isVercelDeployment) {
      status.recommendations.push(
        "For local development, set GOOGLE_APPLICATION_CREDENTIALS to service account key file path",
      )
      status.recommendations.push("Download service account key from Google Cloud Console")
    }
  }

  if (authMethod === "vercel-oidc") {
    status.recommendations.push("Using Vercel OIDC Workload Identity Federation (recommended for production)")
  } else if (authMethod === "service-account-file") {
    status.recommendations.push("Using service account file (good for local development)")
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

// Analytics configuration and validation
export const analyticsConfig = {
  ga4PropertyId: process.env.GA4_PROPERTY_ID,
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpProjectNumber: process.env.GCP_PROJECT_NUMBER,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  gcpWorkloadIdentityPoolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
  gcpWorkloadIdentityPoolProviderId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
  gcpWorkloadIdentityProvider: process.env.GCP_WORKLOAD_IDENTITY_PROVIDER,
  gcpServiceAccountImpersonationUrl: process.env.GCP_SERVICE_ACCOUNT_IMPERSONATION_URL,
}

export function validateAnalyticsConfig(): boolean {
  const required = [analyticsConfig.ga4PropertyId, analyticsConfig.gcpProjectId, analyticsConfig.gcpServiceAccountEmail]

  // Check for Vercel OIDC configuration
  const hasVercelOIDC = !!(
    analyticsConfig.gcpWorkloadIdentityPoolId &&
    analyticsConfig.gcpWorkloadIdentityPoolProviderId &&
    analyticsConfig.gcpProjectNumber
  )

  // Check for alternative configuration
  const hasAlternativeConfig = !!(
    analyticsConfig.gcpWorkloadIdentityProvider && analyticsConfig.gcpServiceAccountImpersonationUrl
  )

  const hasBasicConfig = required.every(Boolean)
  const hasAuthConfig = hasVercelOIDC || hasAlternativeConfig

  console.log("[Analytics Config] Validation:", {
    hasBasicConfig,
    hasVercelOIDC,
    hasAlternativeConfig,
    hasAuthConfig,
    ga4PropertyId: !!analyticsConfig.ga4PropertyId,
    gcpProjectId: !!analyticsConfig.gcpProjectId,
    gcpServiceAccountEmail: !!analyticsConfig.gcpServiceAccountEmail,
  })

  return hasBasicConfig && hasAuthConfig
}

export function getConfigurationStatus() {
  return {
    ga4PropertyId: !!analyticsConfig.ga4PropertyId,
    gcpProjectId: !!analyticsConfig.gcpProjectId,
    gcpServiceAccountEmail: !!analyticsConfig.gcpServiceAccountEmail,
    gcpWorkloadIdentityPoolId: !!analyticsConfig.gcpWorkloadIdentityPoolId,
    gcpWorkloadIdentityPoolProviderId: !!analyticsConfig.gcpWorkloadIdentityPoolProviderId,
    gcpProjectNumber: !!analyticsConfig.gcpProjectNumber,
    gcpWorkloadIdentityProvider: !!analyticsConfig.gcpWorkloadIdentityProvider,
    gcpServiceAccountImpersonationUrl: !!analyticsConfig.gcpServiceAccountImpersonationUrl,
    isVercelDeployment: !!process.env.VERCEL,
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
  }
}

export function getWorkloadIdentityAudience(): string {
  if (analyticsConfig.gcpWorkloadIdentityPoolId && analyticsConfig.gcpWorkloadIdentityPoolProviderId) {
    return `//iam.googleapis.com/projects/${analyticsConfig.gcpProjectNumber}/locations/global/workloadIdentityPools/${analyticsConfig.gcpWorkloadIdentityPoolId}/providers/${analyticsConfig.gcpWorkloadIdentityPoolProviderId}`
  }
  return analyticsConfig.gcpWorkloadIdentityProvider || ""
}

export function getServiceAccountImpersonationUrl(): string {
  if (analyticsConfig.gcpServiceAccountEmail) {
    return `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${analyticsConfig.gcpServiceAccountEmail}:generateAccessToken`
  }
  return analyticsConfig.gcpServiceAccountImpersonationUrl || ""
}

export function isVercelOIDCConfigured(): boolean {
  return !!(
    analyticsConfig.gcpWorkloadIdentityPoolId &&
    analyticsConfig.gcpWorkloadIdentityPoolProviderId &&
    analyticsConfig.gcpProjectNumber &&
    process.env.VERCEL
  )
}

export function getAuthenticationMethod(): string {
  if (isVercelOIDCConfigured()) {
    return "vercel-oidc"
  }
  if (analyticsConfig.gcpWorkloadIdentityProvider && analyticsConfig.gcpServiceAccountImpersonationUrl) {
    return "workload-identity"
  }
  return "not-configured"
}

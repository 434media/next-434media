// Google Analytics 4 Configuration
export const analyticsConfig = {
  ga4PropertyId: process.env.GA4_PROPERTY_ID,
  gcpProjectId: process.env.GCP_PROJECT_ID,
  gcpServiceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  gcpWorkloadIdentityProvider: process.env.GCP_WORKLOAD_IDENTITY_PROVIDER,
  gcpServiceAccountImpersonationUrl: process.env.GCP_SERVICE_ACCOUNT_IMPERSONATION_URL,
}

// Validate that all required environment variables are present
export function validateAnalyticsConfig(): boolean {
  const required = [
    analyticsConfig.ga4PropertyId,
    analyticsConfig.gcpProjectId,
    analyticsConfig.gcpServiceAccountEmail,
    analyticsConfig.gcpWorkloadIdentityProvider,
    analyticsConfig.gcpServiceAccountImpersonationUrl,
  ]

  return required.every((value) => value && value.trim() !== "")
}

// Get configuration status for debugging
export function getConfigurationStatus() {
  return {
    ga4PropertyId: !!analyticsConfig.ga4PropertyId,
    gcpProjectId: !!analyticsConfig.gcpProjectId,
    gcpServiceAccountEmail: !!analyticsConfig.gcpServiceAccountEmail,
    gcpWorkloadIdentityProvider: !!analyticsConfig.gcpWorkloadIdentityProvider,
    gcpServiceAccountImpersonationUrl: !!analyticsConfig.gcpServiceAccountImpersonationUrl,
    isVercelDeployment: !!process.env.VERCEL,
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
  }
}

// Helper functions for Vercel OIDC Workload Identity Federation
export function getWorkloadIdentityAudience(): string {
  if (!analyticsConfig.gcpWorkloadIdentityProvider) {
    throw new Error("GCP_WORKLOAD_IDENTITY_PROVIDER environment variable is required")
  }
  return `//iam.googleapis.com/${analyticsConfig.gcpWorkloadIdentityProvider}`
}

export function getServiceAccountImpersonationUrl(): string {
  if (!analyticsConfig.gcpServiceAccountImpersonationUrl) {
    throw new Error("GCP_SERVICE_ACCOUNT_IMPERSONATION_URL environment variable is required")
  }
  return analyticsConfig.gcpServiceAccountImpersonationUrl
}

// Check if Vercel OIDC is properly configured
export function isVercelOIDCConfigured(): boolean {
  return !!(
    analyticsConfig.gcpWorkloadIdentityProvider &&
    analyticsConfig.gcpServiceAccountImpersonationUrl &&
    process.env.VERCEL
  )
}

export function getAuthenticationMethod(): "vercel-oidc" | "not-configured" {
  return isVercelOIDCConfigured() ? "vercel-oidc" : "not-configured"
}

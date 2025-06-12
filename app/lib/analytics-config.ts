// Simplified Google Analytics 4 Configuration - Service Account Key Only
export const analyticsConfig = {
  // Google Analytics
  ga4PropertyId: process.env.GA4_PROPERTY_ID,

  // Google Cloud Project
  gcpProjectId: process.env.GCP_PROJECT_ID,

  // Service Account Authentication (JSON key)
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,
} as const

// Get missing environment variables
export function getMissingEnvironmentVariables(): string[] {
  const missing = []

  if (!analyticsConfig.ga4PropertyId) missing.push("GA4_PROPERTY_ID")
  if (!analyticsConfig.gcpProjectId) missing.push("GCP_PROJECT_ID")
  if (!analyticsConfig.googleServiceAccountKey) missing.push("GOOGLE_SERVICE_ACCOUNT_KEY")
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

  // Validate JSON key format
  if (analyticsConfig.googleServiceAccountKey) {
    try {
      const parsed = JSON.parse(analyticsConfig.googleServiceAccountKey)
      if (!parsed.client_email || !parsed.private_key) {
        console.error("[Analytics Config] GOOGLE_SERVICE_ACCOUNT_KEY missing required fields")
        return false
      }
    } catch (error) {
      console.error("[Analytics Config] GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON")
      return false
    }
  }

  return true
}

// Check if analytics is properly configured
export function isAnalyticsConfigured(): boolean {
  return validateAnalyticsConfig()
}

// Get configuration status for debugging
export function getConfigurationStatus() {
  const missing = getMissingEnvironmentVariables()

  return {
    configured: validateAnalyticsConfig(),
    missingVariables: missing,
    propertyId: analyticsConfig.ga4PropertyId,
    projectId: analyticsConfig.gcpProjectId,
    hasServiceAccountKey: !!analyticsConfig.googleServiceAccountKey,
    hasAdminPassword: !!analyticsConfig.adminPassword,
    environmentVariables: {
      GA4_PROPERTY_ID: !!process.env.GA4_PROPERTY_ID,
      GCP_PROJECT_ID: !!process.env.GCP_PROJECT_ID,
      GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    },
  }
}

// Multi-Property Google Analytics 4 Configuration
export const analyticsConfig = {
  // Google Analytics Property IDs
  ga4PropertyId: process.env.GA4_PROPERTY_ID, // Main property
  ga4PropertyIdTxmx: process.env.GA4_PROPERTY_ID_TXMX,
  ga4PropertyIdVemosVamos: process.env.GA4_PROPERTY_ID_VEMOSVAMOS,
  ga4PropertyIdAim: process.env.GA4_PROPERTY_ID_AIM,
  ga4PropertyIdSalute: process.env.GA4_PROPERTY_ID_SALUTE,
  ga4PropertyIdAmpd: process.env.GA4_PROPERTY_ID_AMPD,
  ga4PropertyIdDigitalCanvas: process.env.GA4_PROPERTY_ID_DIGITALCANVAS,

  // Google Cloud Project
  gcpProjectId: process.env.GCP_PROJECT_ID,

  // Service Account Authentication (JSON key)
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,

  // Admin authentication
  adminPassword: process.env.ADMIN_PASSWORD,
} as const

// Property configuration array
export const ANALYTICS_PROPERTIES = [
  { id: "main", name: "434 MEDIA", envKey: "GA4_PROPERTY_ID" },
  { id: "txmx", name: "TXMX Boxing", envKey: "GA4_PROPERTY_ID_TXMX" },
  { id: "vemosvamos", name: "Vemos Vamos", envKey: "GA4_PROPERTY_ID_VEMOSVAMOS" },
  { id: "aim", name: "AIM Health R&D Summit", envKey: "GA4_PROPERTY_ID_AIM" },
  { id: "salute", name: "Salute to Troops", envKey: "GA4_PROPERTY_ID_SALUTE" },
  { id: "ampd", name: "The AMPD Project", envKey: "GA4_PROPERTY_ID_AMPD" },
  { id: "digitalcanvas", name: "Digital Canvas", envKey: "GA4_PROPERTY_ID_DIGITALCANVAS" },
] as const

// Get property ID by environment key
export function getPropertyIdByKey(envKey: string): string | undefined {
  switch (envKey) {
    case "GA4_PROPERTY_ID":
      return analyticsConfig.ga4PropertyId
    case "GA4_PROPERTY_ID_TXMX":
      return analyticsConfig.ga4PropertyIdTxmx
    case "GA4_PROPERTY_ID_VEMOSVAMOS":
      return analyticsConfig.ga4PropertyIdVemosVamos
    case "GA4_PROPERTY_ID_AIM":
      return analyticsConfig.ga4PropertyIdAim
    case "GA4_PROPERTY_ID_SALUTE":
      return analyticsConfig.ga4PropertyIdSalute
    case "GA4_PROPERTY_ID_AMPD":
      return analyticsConfig.ga4PropertyIdAmpd
    case "GA4_PROPERTY_ID_DIGITALCANVAS":
      return analyticsConfig.ga4PropertyIdDigitalCanvas
    default:
      return undefined
  }
}

// Get missing environment variables
export function getMissingEnvironmentVariables(): string[] {
  const missing = []

  // Core required variables
  if (!analyticsConfig.gcpProjectId) missing.push("GCP_PROJECT_ID")
  if (!analyticsConfig.googleServiceAccountKey) missing.push("GOOGLE_SERVICE_ACCOUNT_KEY")
  if (!analyticsConfig.adminPassword) missing.push("ADMIN_PASSWORD")

  // Property IDs (at least main property should be configured)
  if (!analyticsConfig.ga4PropertyId) missing.push("GA4_PROPERTY_ID")

  return missing
}

// Get configured properties
export function getConfiguredProperties() {
  return ANALYTICS_PROPERTIES.filter((property) => {
    const propertyId = getPropertyIdByKey(property.envKey)
    return propertyId && propertyId.trim() !== ""
  })
}

// Get missing property environment variables
export function getMissingPropertyVariables(): string[] {
  return ANALYTICS_PROPERTIES.filter((property) => !getPropertyIdByKey(property.envKey)).map(
    (property) => property.envKey,
  )
}

// Validation function for required environment variables
export function validateAnalyticsConfig(): boolean {
  const missing = getMissingEnvironmentVariables()

  if (missing.length > 0) {
    console.error("[Analytics Config] Missing required environment variables:", missing)
    return false
  }

  // Additional validation for format - check main property
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
  const configuredProperties = getConfiguredProperties()
  const missingProperties = getMissingPropertyVariables()

  return {
    configured: validateAnalyticsConfig(),
    missingVariables: missing,
    configuredProperties,
    missingProperties,
    propertyId: analyticsConfig.ga4PropertyId,
    projectId: analyticsConfig.gcpProjectId,
    hasServiceAccountKey: !!analyticsConfig.googleServiceAccountKey,
    hasAdminPassword: !!analyticsConfig.adminPassword,
    environmentVariables: {
      GA4_PROPERTY_ID: !!process.env.GA4_PROPERTY_ID,
      GA4_PROPERTY_ID_TXMX: !!process.env.GA4_PROPERTY_ID_TXMX,
      GA4_PROPERTY_ID_VEMOSVAMOS: !!process.env.GA4_PROPERTY_ID_VEMOSVAMOS,
      GA4_PROPERTY_ID_AIM: !!process.env.GA4_PROPERTY_ID_AIM,
      GA4_PROPERTY_ID_SALUTE: !!process.env.GA4_PROPERTY_ID_SALUTE,
      GA4_PROPERTY_ID_AMPD: !!process.env.GA4_PROPERTY_ID_AMPD,
      GA4_PROPERTY_ID_DIGITALCANVAS: !!process.env.GA4_PROPERTY_ID_DIGITALCANVAS,
      GCP_PROJECT_ID: !!process.env.GCP_PROJECT_ID,
      GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    },
  }
}

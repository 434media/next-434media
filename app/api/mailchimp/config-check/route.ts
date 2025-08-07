import { NextResponse } from "next/server"
import { validateMailchimpConfig, isMailchimpConfigured } from "../../../lib/mailchimp-config"

export async function GET() {
  try {
    console.log("[Mailchimp Config Check] Validating configuration...")

    const validationResult = validateMailchimpConfig()
    const isConfigured = isMailchimpConfigured()

    const response = {
      configured: isConfigured,
      validation: {
        hasApiKey: !!process.env.MAILCHIMP_API_KEY,
        hasServerPrefix: !!process.env.MAILCHIMP_API_KEY?.split("-")[1],
        hasAudienceIds: !!(
          process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID_TXMX
        ),
        missingVariables: validationResult.validation?.missingVariables || [],
        configuredProperties:
          validationResult.validation?.configuredProperties.map((prop) => prop.name) || [],
      },
      timestamp: new Date().toISOString(),
    }

    console.log("[Mailchimp Config Check] Configuration status:", response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Mailchimp Config Check] Error:", error)

    return NextResponse.json(
      {
        configured: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

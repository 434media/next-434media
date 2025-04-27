import { type NextRequest, NextResponse } from "next/server"
import { i18n } from "../../../i18n-config"

export async function GET(request: NextRequest) {
  try {
    // Get locale from query parameter
    const searchParams = request.nextUrl.searchParams
    const locale = searchParams.get("locale") || i18n.defaultLocale

    // Validate locale
    const validLocale = i18n.locales.includes(locale as any) ? locale : i18n.defaultLocale

    // Load dictionary
    const dictionary = await import(`../../dictionaries/${validLocale}.json`).then((module) => module.default)

    // Return dictionary as JSON
    return NextResponse.json(dictionary)
  } catch (error) {
    console.error("Error loading dictionary:", error)

    // Return error response
    return NextResponse.json({ error: "Failed to load dictionary" }, { status: 500 })
  }
}

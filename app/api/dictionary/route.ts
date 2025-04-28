import { type NextRequest, NextResponse } from "next/server"
import { i18n } from "../../../i18n-config"

export async function GET(request: NextRequest) {
  try {
    // Get locale from query parameter
    const { searchParams } = new URL(request.url)
    let locale = searchParams.get("locale") || i18n.defaultLocale

    // Validate locale
    if (!i18n.locales.includes(locale as any)) {
      locale = i18n.defaultLocale
    }

    // Import the dictionary
    const dictionary = await import(`../../dictionaries/${locale}.json`)

    // Set cache headers
    const headers = new Headers()
    headers.set("Cache-Control", "public, max-age=60, s-maxage=60")

    return NextResponse.json(dictionary, {
      headers,
      status: 200,
    })
  } catch (error) {
    console.error("Error in dictionary API route:", error)
    return NextResponse.json({ error: "Failed to load dictionary" }, { status: 500 })
  }
}

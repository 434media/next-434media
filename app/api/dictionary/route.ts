import { type NextRequest, NextResponse } from "next/server"
import { getDictionary } from "@/lib/dictionary"
import { i18n, type Locale } from "../../../i18n-config"

export async function GET(request: NextRequest) {
  try {
    // Get locale from query parameter
    const { searchParams } = new URL(request.url)
    const localeParam = searchParams.get("locale") || i18n.defaultLocale

    // Type guard to ensure locale is valid
    const isValidLocale = (locale: string): locale is Locale => {
      return i18n.locales.includes(locale as Locale)
    }

    // Validate locale
    if (!isValidLocale(localeParam)) {
      return NextResponse.json(
        { error: `Invalid locale: ${localeParam}. Supported locales are: ${i18n.locales.join(", ")}` },
        { status: 400 },
      )
    }

    // Get dictionary for the requested locale (now properly typed)
    const dictionary = await getDictionary(localeParam)

    return NextResponse.json(dictionary)
  } catch (error) {
    console.error("Error fetching dictionary:", error)
    return NextResponse.json({ error: "Failed to fetch dictionary" }, { status: 500 })
  }
}

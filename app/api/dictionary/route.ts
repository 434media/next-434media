import { type NextRequest, NextResponse } from "next/server"
import { getDictionary } from "@/app/lib/dictionary"
import { i18n } from "@/i18n-config"

export async function GET(request: NextRequest) {
  try {
    // Get locale from query parameter
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || i18n.defaultLocale

    // Validate locale
    if (!i18n.locales.includes(locale as any)) {
      return NextResponse.json(
        { error: `Invalid locale: ${locale}. Supported locales are: ${i18n.locales.join(", ")}` },
        { status: 400 },
      )
    }

    // Get dictionary for the requested locale
    const dictionary = await getDictionary(locale as any)

    return NextResponse.json(dictionary)
  } catch (error) {
    console.error("Error fetching dictionary:", error)
    return NextResponse.json({ error: "Failed to fetch dictionary" }, { status: 500 })
  }
}

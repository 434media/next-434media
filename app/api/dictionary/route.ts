import { type NextRequest, NextResponse } from "next/server"
import { getDictionary } from "@/app/lib/dictionary"

// Convert to Edge Function
export const runtime = "edge"

export async function GET(request: NextRequest) {
  try {
    const locale = request.nextUrl.searchParams.get("locale") || "en"

    // Validate locale
    if (locale !== "en" && locale !== "es") {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
    }

    const dictionary = await getDictionary(locale as "en" | "es")

    // Add cache headers for better performance
    const response = NextResponse.json(dictionary)
    response.headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600")

    return response
  } catch (error) {
    console.error("Error fetching dictionary:", error)
    return NextResponse.json({ error: "Failed to fetch dictionary" }, { status: 500 })
  }
}

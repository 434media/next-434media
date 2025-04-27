import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { match } from "@formatjs/intl-localematcher"
import Negotiator from "negotiator"
import { i18n } from "./i18n-config"

function getLocale(request: NextRequest): string {
  try {
    // Check for the NEXT_LOCALE cookie first
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
    if (cookieLocale && i18n.locales.includes(cookieLocale as any)) {
      return cookieLocale
    }

    // Negotiator expects plain object so we need to transform headers
    const negotiatorHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => (negotiatorHeaders[key] = value))

    // Use negotiator and intl-localematcher to get best locale
    let languages = new Negotiator({ headers: negotiatorHeaders }).languages()

    // Fall back to default locale if no match
    if (!languages || languages.length === 0) {
      languages = [i18n.defaultLocale]
    }

    return match(languages, i18n.locales, i18n.defaultLocale)
  } catch (error) {
    console.error("Error in getLocale:", error)
    return i18n.defaultLocale
  }
}

export function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname

    // Skip processing for static files and API routes
    if (
      pathname.startsWith("/_next") ||
      pathname.includes("/api/") ||
      pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|css|js)$/)
    ) {
      return NextResponse.next()
    }

    // Handle case-insensitive SDOH to sdoh redirect
    if (pathname.match(/\/[a-z]{2}\/SDOH\/?$/i) && pathname !== `/en/sdoh` && pathname !== `/es/sdoh`) {
      const locale = pathname.split("/")[1]
      const newUrl = new URL(`/${locale}/sdoh`, request.url)
      return NextResponse.redirect(newUrl)
    }

    // ONLY handle internationalization for the SDOH page
    // If the path is /sdoh, redirect to /en/sdoh or /es/sdoh based on locale
    if (pathname === "/sdoh" || pathname === "/SDOH") {
      const locale = getLocale(request)
      const newUrl = new URL(`/${locale}/sdoh`, request.url)
      return NextResponse.redirect(newUrl)
    }

    // For all other paths, don't apply internationalization
    // This ensures the main home route doesn't redirect to /en or /es
    return NextResponse.next()
  } catch (error) {
    console.error("Error in middleware:", error)
    return NextResponse.next()
  }
}

export const config = {
  // Improved matcher pattern for better performance
  matcher: [
    // Skip all internal paths and static files
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
}

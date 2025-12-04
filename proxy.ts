import { type NextRequest, NextResponse } from "next/server"
import { i18n } from "./i18n-config"

// Define a list of paths that should bypass the proxy
const BYPASS_PATHS = ["/_next/", "/api/", "/favicon.ico", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".mp3", ".mp4"]

export const config = {
  // Only run proxy on specific paths to improve performance
  matcher: [
    // Skip all internal paths (_next)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Skip proxy for paths that should bypass
  if (BYPASS_PATHS.some((path) => pathname.includes(path))) {
    return NextResponse.next()
  }

  // Handle case-insensitive SDOH to sdoh redirect
  if (pathname.match(/\/[a-z]{2}\/SDOH\/?$/i) && pathname !== `/en/sdoh` && pathname !== `/es/sdoh`) {
    const locale = pathname.split("/")[1]
    const newUrl = new URL(`/${locale}/sdoh`, request.url)
    return NextResponse.redirect(newUrl)
  }

  // ONLY handle internationalization for the SDOH page
  if (pathname === "/sdoh" || pathname === "/SDOH") {
    try {
      // Get locale from cookie or default to English
      const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
      const locale = cookieLocale && i18n.locales.includes(cookieLocale as any) ? cookieLocale : i18n.defaultLocale

      const newUrl = new URL(`/${locale}/sdoh`, request.url)
      return NextResponse.redirect(newUrl)
    } catch (error) {
      console.error("Error redirecting to localized SDOH page:", error)
      // Fallback to default locale
      const newUrl = new URL(`/${i18n.defaultLocale}/sdoh`, request.url)
      return NextResponse.redirect(newUrl)
    }
  }

  // For all other paths, don't apply internationalization
  return NextResponse.next()
}

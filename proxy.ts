import { type NextRequest, NextResponse } from "next/server"
import { i18n } from "./i18n-config"
import { META_PIXEL_COOKIE, metaPixelAllowed } from "./lib/meta-pixel-gate"
import { isTrackedPath } from "./lib/tracking-scope"

// Define a list of paths that should bypass the proxy
const BYPASS_PATHS = ["/_next/", "/api/", "/favicon.ico", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".mp3", ".mp4"]

export const config = {
  // Page routes only. Everything the proxy has no reason to touch is excluded
  // here rather than inspected per request: build assets, the image optimizer,
  // API routes, the files at the app root (robots.txt, sitemap.xml, llms.txt,
  // the OG and Twitter images, the icons) and any path ending in a file
  // extension. Every public page has to match, or it would never receive the
  // Meta Pixel cookie and the pixel would silently never load there —
  // lib/__tests__/proxy-matcher.test.ts asserts both directions.
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml|llms\\.txt|(?:.*/)?opengraph-image|(?:.*/)?twitter-image|apple-icon|apple-touch-icon|.*\\.[A-Za-z0-9]+$).*)",
  ],
}

/**
 * Meta Pixel jurisdiction gate (lib/meta-pixel-gate.ts). Allowed visitors get
 * `434_px=1`; everyone else gets no cookie, and a stale one is removed. Only on
 * tracked routes: /admin, /travel and /squads never load the pixel, so the
 * proxy leaves their cookies alone.
 */
function withMetaPixelGate(request: NextRequest, response: NextResponse): NextResponse {
  if (!isTrackedPath(request.nextUrl.pathname)) return response

  const country = request.headers.get("x-vercel-ip-country")
  if (metaPixelAllowed(country, process.env.VERCEL === "1")) {
    response.cookies.set({
      name: META_PIXEL_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24,
    })
  } else if (request.cookies.has(META_PIXEL_COOKIE)) {
    response.cookies.delete(META_PIXEL_COOKIE)
  }
  return response
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
  return withMetaPixelGate(request, NextResponse.next())
}

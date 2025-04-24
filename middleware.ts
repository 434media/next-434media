import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the path is /SDOH (case-sensitive check)
  if (pathname === "/SDOH") {
    // Create a new URL for the redirect destination
    const url = request.nextUrl.clone()
    url.pathname = "/sdoh"

    // Return a redirect response
    return NextResponse.redirect(url)
  }

  // For all other paths, continue with the request
  return NextResponse.next()
}

// Configure the middleware to only run on specific paths
export const config = {
  matcher: ["/SDOH"],
}

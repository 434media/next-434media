import { headers } from "next/headers"

export interface ExtractedUserData {
  clientIpAddress?: string
  clientUserAgent?: string
  fbc?: string
  fbp?: string
  email?: string
  phone?: string
}

export async function extractUserDataFromRequest(): Promise<ExtractedUserData> {
  try {
    const headersList = await headers()

    // Enhanced IP address extraction for production environments (Vercel, etc.)
    const clientIpAddress =
      // Vercel-specific headers
      headersList.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      // Standard forwarded headers
      headersList
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() ||
      headersList.get("x-real-ip") ||
      // Cloudflare
      headersList.get("cf-connecting-ip") ||
      // Other common headers
      headersList.get("x-client-ip") ||
      headersList.get("x-forwarded") ||
      headersList.get("forwarded-for") ||
      headersList.get("forwarded") ||
      // Fallback for local development
      "127.0.0.1"

    // Extract user agent with fallback
    const clientUserAgent = headersList.get("user-agent") || "unknown-agent"

    // Extract Facebook cookies from cookie header with better parsing
    const cookieHeader = headersList.get("cookie")
    let fbc: string | undefined
    let fbp: string | undefined

    if (cookieHeader) {
      try {
        const cookies = cookieHeader.split(";").reduce(
          (acc, cookie) => {
            const [key, value] = cookie.trim().split("=")
            if (key && value) {
              acc[key] = decodeURIComponent(value)
            }
            return acc
          },
          {} as Record<string, string>,
        )

        fbc = cookies._fbc
        fbp = cookies._fbp
      } catch (cookieError) {
        console.warn("Failed to parse cookies:", cookieError)
      }
    }

    const userData = {
      clientIpAddress,
      clientUserAgent,
      fbc,
      fbp,
    }

    // Log for debugging in production (remove in final version)
    console.log("Extracted user data:", {
      ...userData,
      hasIp: !!userData.clientIpAddress,
      hasUserAgent: !!userData.clientUserAgent,
      hasFbc: !!userData.fbc,
      hasFbp: !!userData.fbp,
    })

    return userData
  } catch (error) {
    console.error("Error extracting user data from request:", error)

    // Return minimal fallback data
    return {
      clientIpAddress: "127.0.0.1",
      clientUserAgent: "unknown-agent",
    }
  }
}

export function extractProductInfo(productData: any) {
  try {
    return {
      content_ids: [productData.productId],
      content_type: "product",
      content_name: productData.productTitle,
      content_category: "txmx-boxing",
      value: productData.value,
      currency: productData.currency,
    }
  } catch (error) {
    console.error("Error extracting product info:", error)
    throw new Error("Invalid product data provided")
  }
}

export function extractCartInfo(cartData: any) {
  try {
    return {
      content_ids: cartData.products?.map((p: any) => p.productId) || [],
      content_type: "product",
      content_category: "txmx-boxing",
      value: cartData.value,
      currency: cartData.currency,
      num_items: cartData.numItems,
    }
  } catch (error) {
    console.error("Error extracting cart info:", error)
    throw new Error("Invalid cart data provided")
  }
}

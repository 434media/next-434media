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
  const headersList = await headers()

  // Extract IP address
  const clientIpAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") ||
    headersList.get("x-client-ip") ||
    undefined

  // Extract user agent
  const clientUserAgent = headersList.get("user-agent") || undefined

  // Extract Facebook cookies from cookie header
  const cookieHeader = headersList.get("cookie")
  let fbc: string | undefined
  let fbp: string | undefined

  if (cookieHeader) {
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
  }

  return {
    clientIpAddress,
    clientUserAgent,
    fbc,
    fbp,
  }
}

export function extractProductInfo(productData: any) {
  return {
    content_ids: [productData.productId],
    content_type: "product",
    content_name: productData.productTitle,
    content_category: "txmx-boxing",
    value: productData.value,
    currency: productData.currency,
  }
}

export function extractCartInfo(cartData: any) {
  return {
    content_ids: cartData.products?.map((p: any) => p.productId) || [],
    content_type: "product",
    content_category: "txmx-boxing",
    value: cartData.value,
    currency: cartData.currency,
    num_items: cartData.numItems,
  }
}

import { MetaConversionsAPI } from "./meta-conversions-api"
import { extractUserDataFromRequest, extractProductInfo, extractCartInfo } from "./meta-user-data"

// Initialize Meta Conversions API client
const metaAPI = new MetaConversionsAPI(
  process.env.META_PIXEL_ID!,
  process.env.META_ACCESS_TOKEN!,
  process.env.META_TEST_EVENT_CODE,
)

export async function trackTXMXPageView(eventId?: string, eventSourceUrl?: string) {
  try {
    const userData = await extractUserDataFromRequest()

    return await metaAPI.trackPageView(userData, eventId, eventSourceUrl)
  } catch (error) {
    console.error("Error tracking TXMX page view:", error)
    return false
  }
}

export async function trackTXMXViewContent(
  productData: {
    productId: string
    productTitle: string
    productHandle: string
    value: number
    currency: string
  },
  eventId?: string,
  eventSourceUrl?: string,
) {
  try {
    const userData = await extractUserDataFromRequest()
    const customData = extractProductInfo(productData)

    return await metaAPI.trackViewContent(userData, customData, eventId, eventSourceUrl)
  } catch (error) {
    console.error("Error tracking TXMX view content:", error)
    return false
  }
}

export async function trackTXMXAddToCart(
  productData: {
    productId: string
    productTitle: string
    productHandle: string
    variantId: string
    variantTitle: string
    quantity: number
    value: number
    currency: string
  },
  eventId?: string,
  eventSourceUrl?: string,
) {
  try {
    const userData = await extractUserDataFromRequest()
    const customData = {
      content_ids: [productData.productId],
      content_type: "product",
      content_name: productData.productTitle,
      content_category: "txmx-boxing",
      value: productData.value,
      currency: productData.currency,
      num_items: productData.quantity,
    }

    return await metaAPI.trackAddToCart(userData, customData, eventId, eventSourceUrl)
  } catch (error) {
    console.error("Error tracking TXMX add to cart:", error)
    return false
  }
}

export async function trackTXMXInitiateCheckout(
  cartData: {
    cartId: string
    value: number
    currency: string
    numItems: number
    products: Array<{
      productId: string
      productTitle: string
      productHandle: string
      variantId: string
      variantTitle: string
      quantity: number
      price: number
    }>
  },
  eventId?: string,
  eventSourceUrl?: string,
) {
  try {
    const userData = await extractUserDataFromRequest()
    const customData = extractCartInfo(cartData)

    return await metaAPI.trackInitiateCheckout(userData, customData, eventId, eventSourceUrl)
  } catch (error) {
    console.error("Error tracking TXMX initiate checkout:", error)
    return false
  }
}

export async function trackTXMXPurchase(
  orderData: {
    orderId: string
    value: number
    currency: string
    numItems: number
    products: Array<{
      productId: string
      productTitle: string
      quantity: number
      price: number
    }>
  },
  eventId?: string,
  eventSourceUrl?: string,
) {
  try {
    const userData = await extractUserDataFromRequest()
    const customData = {
      content_ids: orderData.products.map((p) => p.productId),
      content_type: "product",
      content_category: "txmx-boxing",
      value: orderData.value,
      currency: orderData.currency,
      num_items: orderData.numItems,
    }

    return await metaAPI.trackPurchase(userData, customData, eventId, eventSourceUrl)
  } catch (error) {
    console.error("Error tracking TXMX purchase:", error)
    return false
  }
}

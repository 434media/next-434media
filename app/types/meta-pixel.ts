// Meta Pixel Types
export interface MetaPixelEvent {
  eventName: string
  eventId?: string
  eventData?: {
    content_ids?: string[]
    content_type?: string
    content_name?: string
    content_category?: string
    value?: number
    currency?: string
    num_items?: number
    product_catalog_id?: string
  }
}

export interface TXMXProductData {
  productId: string
  productTitle: string
  productHandle: string
  variantId?: string
  variantTitle?: string
  quantity?: number
  value: number
  currency: string
}

export interface TXMXCartData {
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
}

export interface TXMXOrderData {
  orderId: string
  value: number
  currency: string
  numItems: number
  email?: string
  products: Array<{
    productId: string
    productTitle: string
    quantity: number
    price: number
  }>
}

// Extend Window interface to include fbq
declare global {
  interface Window {
    fbq: (
      action: "track" | "trackCustom" | "init" | "consent",
      eventName: string,
      parameters?: Record<string, any>,
    ) => void
  }
}

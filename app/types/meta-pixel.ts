// Meta Pixel types
export interface MetaPixelEvent {
  eventID?: string
}

export interface MetaPixelViewContentData {
  content_ids: string[]
  content_type: string
  content_name: string
  content_category: string
  value: number
  currency: string
}

export interface MetaPixelAddToCartData {
  content_ids: string[]
  content_type: string
  content_name: string
  content_category: string
  value: number
  currency: string
  num_items: number
}

export interface MetaPixelInitiateCheckoutData {
  content_ids: string[]
  content_type: string
  content_category: string
  value: number
  currency: string
  num_items: number
}

export interface MetaPixelPurchaseData {
  content_ids: string[]
  content_type: string
  content_category: string
  value: number
  currency: string
  num_items: number
}

export type MetaPixelEventData =
  | MetaPixelViewContentData
  | MetaPixelAddToCartData
  | MetaPixelInitiateCheckoutData
  | MetaPixelPurchaseData

export interface FacebookPixel {
  (action: "track", eventName: string, data: MetaPixelEventData, options?: MetaPixelEvent): void
  (action: "trackCustom", eventName: string, data?: Record<string, any>, options?: MetaPixelEvent): void
  (action: "init", pixelId: string, options?: Record<string, any>): void
}

// Extend the Window interface to include fbq
declare global {
  interface Window {
    fbq?: FacebookPixel
  }
}

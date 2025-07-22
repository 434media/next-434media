import crypto from "crypto"

interface UserData {
  em?: string[]
  ph?: string[]
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string
  fbp?: string
}

interface CustomData {
  content_ids?: string[]
  content_type?: string
  content_name?: string
  content_category?: string
  value?: number
  currency?: string
  num_items?: number
  product_catalog_id?: string
}

interface ServerEvent {
  event_name: string
  event_time: number
  event_id?: string
  user_data: UserData
  custom_data?: CustomData
  action_source: string
  event_source_url?: string
}

interface ConversionsAPIPayload {
  data: ServerEvent[]
  test_event_code?: string
}

export class MetaConversionsAPI {
  private pixelId: string
  private accessToken: string
  private testEventCode?: string

  constructor(pixelId: string, accessToken: string, testEventCode?: string) {
    this.pixelId = pixelId
    this.accessToken = accessToken
    this.testEventCode = testEventCode
  }

  private hashData(data: string): string {
    return crypto.createHash("sha256").update(data.toLowerCase().trim()).digest("hex")
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim()
  }

  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    return phone.replace(/\D/g, "")
  }

  async sendEvent(
    eventName: string,
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    customData?: CustomData,
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    try {
      const hashedUserData: UserData = {
        client_ip_address: userData.clientIpAddress,
        client_user_agent: userData.clientUserAgent,
        fbc: userData.fbc,
        fbp: userData.fbp,
      }

      // Hash email if provided
      if (userData.email) {
        hashedUserData.em = [this.hashData(this.normalizeEmail(userData.email))]
      }

      // Hash phone if provided
      if (userData.phone) {
        hashedUserData.ph = [this.hashData(this.normalizePhone(userData.phone))]
      }

      const serverEvent: ServerEvent = {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user_data: hashedUserData,
        custom_data: customData,
        action_source: "website",
        event_source_url: eventSourceUrl,
      }

      const payload: ConversionsAPIPayload = {
        data: [serverEvent],
      }

      // Add test event code if in development
      if (this.testEventCode) {
        payload.test_event_code = this.testEventCode
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${this.pixelId}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error("Meta Conversions API Error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorData,
        })
        return false
      }

      const result = await response.json()
      console.log("Meta Conversions API Success:", result)
      return true
    } catch (error) {
      console.error("Meta Conversions API Error:", error)
      return false
    }
  }

  async trackPageView(
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    return this.sendEvent("PageView", userData, undefined, eventId, eventSourceUrl)
  }

  async trackViewContent(
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    customData: {
      content_ids: string[]
      content_type: string
      content_name: string
      content_category: string
      value: number
      currency: string
    },
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    return this.sendEvent("ViewContent", userData, customData, eventId, eventSourceUrl)
  }

  async trackAddToCart(
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    customData: {
      content_ids: string[]
      content_type: string
      content_name: string
      content_category: string
      value: number
      currency: string
      num_items: number
    },
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    return this.sendEvent("AddToCart", userData, customData, eventId, eventSourceUrl)
  }

  async trackInitiateCheckout(
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    customData: {
      content_ids: string[]
      content_type: string
      content_category: string
      value: number
      currency: string
      num_items: number
    },
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    return this.sendEvent("InitiateCheckout", userData, customData, eventId, eventSourceUrl)
  }

  async trackPurchase(
    userData: {
      email?: string
      phone?: string
      clientIpAddress?: string
      clientUserAgent?: string
      fbc?: string
      fbp?: string
    },
    customData: {
      content_ids: string[]
      content_type: string
      content_category: string
      value: number
      currency: string
      num_items: number
    },
    eventId?: string,
    eventSourceUrl?: string,
  ): Promise<boolean> {
    return this.sendEvent("Purchase", userData, customData, eventId, eventSourceUrl)
  }
}

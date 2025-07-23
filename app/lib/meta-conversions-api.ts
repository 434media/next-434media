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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
    try {
      // Validate required parameters
      if (!eventName) {
        throw new Error("Event name is required")
      }

      if (!this.pixelId || !this.accessToken) {
        throw new Error("Pixel ID and Access Token are required")
      }

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
        event_id: eventId || `${eventName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_data: hashedUserData,
        custom_data: customData,
        action_source: "website",
        event_source_url: eventSourceUrl,
      }

      const payload: ConversionsAPIPayload = {
        data: [serverEvent],
      }

      // Add test event code if available
      if (this.testEventCode) {
        payload.test_event_code = this.testEventCode
      }

      console.log("Sending Meta Conversions API event:", {
        eventName,
        eventId: serverEvent.event_id,
        pixelId: this.pixelId,
        hasTestCode: !!this.testEventCode,
        userDataKeys: Object.keys(hashedUserData).filter((key) => hashedUserData[key as keyof UserData]),
        customDataKeys: customData ? Object.keys(customData) : [],
      })

      const response = await fetch(`https://graph.facebook.com/v18.0/${this.pixelId}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      })

      const responseText = await response.text()
      let responseData

      try {
        responseData = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse Meta API response:", responseText)
        return {
          success: false,
          error: `Invalid JSON response: ${responseText}`,
        }
      }

      if (!response.ok) {
        console.error("Meta Conversions API Error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseData,
          headers: Object.fromEntries(response.headers.entries()),
        })

        return {
          success: false,
          error: `HTTP ${response.status}: ${responseData?.error?.message || responseText}`,
          response: responseData,
        }
      }

      console.log("Meta Conversions API Success:", responseData)
      return {
        success: true,
        response: responseData,
      }
    } catch (error) {
      console.error("Meta Conversions API Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }
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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
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
  ): Promise<{ success: boolean; error?: string; response?: any }> {
    return this.sendEvent("Purchase", userData, customData, eventId, eventSourceUrl)
  }
}

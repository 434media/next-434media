interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: string
}

export async function safeApiCall<T = any>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    // Ensure we're sending JSON if there's a body
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Check if response is actually JSON
    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      console.error(`API Error: Expected JSON but received ${contentType}`)
      console.error(`URL: ${url}`)
      console.error(`Status: ${response.status} ${response.statusText}`)

      // Try to get response text for debugging
      const responseText = await response.text()
      console.error(`Response body: ${responseText.substring(0, 200)}...`)

      return {
        success: false,
        error: `Server returned ${contentType || "unknown content type"} instead of JSON. Check if API route exists.`,
        details: process.env.NODE_ENV === "development" ? responseText.substring(0, 500) : undefined,
      }
    }

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        details: data.details,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("API call failed:", error)

    if (error instanceof SyntaxError && error.message.includes("Unexpected token")) {
      return {
        success: false,
        error:
          "Server returned invalid JSON. This usually means the API route doesn't exist or returned an HTML error page.",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    }
  }
}

export function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")
  return !!(contentType && contentType.includes("application/json"))
}

export async function handleApiResponse<T = any>(response: Response): Promise<ApiResponse<T>> {
  try {
    if (!isJsonResponse(response)) {
      const responseText = await response.text()
      return {
        success: false,
        error: `Expected JSON but received ${response.headers.get("content-type")}`,
        details: process.env.NODE_ENV === "development" ? responseText.substring(0, 500) : undefined,
      }
    }

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        details: data.details,
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse response",
      details: process.env.NODE_ENV === "development" ? String(error) : undefined,
    }
  }
}

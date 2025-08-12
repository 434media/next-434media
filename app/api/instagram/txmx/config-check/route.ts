import { NextResponse } from "next/server"
import { getInstagramConfigurationStatus, validateInstagramConfig } from "../../../../lib/instagram-config"

async function debugAccessToken() {
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  const inputToken = process.env.INSTAGRAM_ACCESS_TOKEN_TXMX

  if (!appId || !appSecret || !inputToken) {
    return {
      available: false,
      reason: "Missing INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, or INSTAGRAM_ACCESS_TOKEN_TXMX",
    }
  }

  try {
    const url = new URL("https://graph.facebook.com/debug_token")
    url.searchParams.set("input_token", inputToken)
    url.searchParams.set("access_token", `${appId}|${appSecret}`)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (!res.ok) {
      return { available: true, ok: false, error: data?.error || { message: res.statusText } }
    }

    // Standardize output
    return {
      available: true,
      ok: true,
      is_valid: data?.data?.is_valid ?? false,
      type: data?.data?.type,
      app_id: data?.data?.app_id,
      application: data?.data?.application,
      data_access_expires_at: data?.data?.data_access_expires_at,
      expires_at: data?.data?.expires_at,
      issued_at: data?.data?.issued_at,
      scopes: data?.data?.scopes || data?.data?.granular_scopes?.map((s: any) => s.scope) || [],
      granular_scopes: data?.data?.granular_scopes,
      user_id: data?.data?.user_id,
    }
  } catch (err) {
    return { available: true, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET() {
  try {
    const configStatus = getInstagramConfigurationStatus()
    const isValid = validateInstagramConfig()
    const tokenDebug = await debugAccessToken()

    return NextResponse.json({
      success: true,
      configured: isValid,
      status: configStatus,
      token: tokenDebug,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Instagram Config Check] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check Instagram configuration",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

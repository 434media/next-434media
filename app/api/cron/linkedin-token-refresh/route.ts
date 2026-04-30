import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import { refreshLinkedInToken, linkedinConfig } from "@/lib/linkedin-config"

export const runtime = "nodejs"
export const maxDuration = 60

const TOKENS_COLLECTION = "linkedin_tokens"
const TOKEN_DOC_ID = "organization"

interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt: string
  refreshedAt: string
  source: "env" | "refresh"
}

export async function GET(request: NextRequest) {
  return runCronJob("linkedin-token-refresh", request, async () => {
    const db = getDb()
    const docRef = db.collection(TOKENS_COLLECTION).doc(TOKEN_DOC_ID)
    const existing = await docRef.get()

    const existingData = existing.exists ? (existing.data() as StoredToken) : null
    const refreshTokenToUse =
      existingData?.refreshToken ||
      linkedinConfig.refreshToken ||
      process.env.LINKEDIN_REFRESH_TOKEN

    if (!refreshTokenToUse) {
      return {
        message: "No refresh token available — manual re-auth required",
        detail: { hasStoredToken: !!existingData, env: !!process.env.LINKEDIN_REFRESH_TOKEN },
      }
    }

    const expiresAt = existingData?.expiresAt ? new Date(existingData.expiresAt) : null
    const now = new Date()
    const refreshThresholdMs = 24 * 60 * 60 * 1000

    if (expiresAt && expiresAt.getTime() - now.getTime() > refreshThresholdMs) {
      return {
        message: `Token still valid for ${Math.round((expiresAt.getTime() - now.getTime()) / 3600000)}h — skipping refresh`,
        detail: { expiresAt: expiresAt.toISOString() },
      }
    }

    const refreshed = await refreshLinkedInToken(refreshTokenToUse)
    if (!refreshed) {
      throw new Error("LinkedIn token refresh returned null — check client credentials and refresh token")
    }

    const newExpiresAt = new Date(now.getTime() + refreshed.expires_in * 1000)
    const stored: StoredToken = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || refreshTokenToUse,
      expiresAt: newExpiresAt.toISOString(),
      refreshedAt: now.toISOString(),
      source: "refresh",
    }

    await docRef.set(stored)

    return {
      message: `Refreshed LinkedIn token, valid until ${newExpiresAt.toISOString()}`,
      detail: {
        expiresAt: newExpiresAt.toISOString(),
        rotatedRefreshToken: !!refreshed.refresh_token,
      },
    }
  })
}

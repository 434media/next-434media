import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import { INSTAGRAM_API_BASE_URL } from "@/lib/instagram-config"

export const runtime = "nodejs"
export const maxDuration = 300

const SNAPSHOT_COLLECTION = "analytics_snapshots_instagram"
const FETCH_TIMEOUT = 30000

interface AccountConfig {
  key: string
  name: string
  accessToken?: string
  pageId?: string
  businessAccountIdOverride?: string
}

const ACCOUNTS: AccountConfig[] = [
  {
    key: "txmx",
    name: "TXMX Boxing",
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_TXMX,
    pageId: process.env.FACEBOOK_PAGE_ID_TXMX,
    businessAccountIdOverride: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_TXMX,
  },
  {
    key: "vemos",
    name: "Vemos Vamos",
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_VEMOS,
    pageId: process.env.FACEBOOK_PAGE_ID_VEMOS,
    businessAccountIdOverride: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_VEMOS,
  },
  {
    key: "milcity",
    name: "MilCity",
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_MILCITY,
    pageId: process.env.FACEBOOK_PAGE_ID_MILCITY,
    businessAccountIdOverride: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_MILCITY,
  },
  {
    key: "ampd",
    name: "AMPD Project",
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN_AMPD,
    pageId: process.env.FACEBOOK_PAGE_ID_AMPD,
    businessAccountIdOverride: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID_AMPD,
  },
]

async function graph<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${INSTAGRAM_API_BASE_URL}/${path}`)
  url.searchParams.append("access_token", accessToken)
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`IG ${res.status}: ${body.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

function looksIGUserId(val?: string): boolean {
  return !!val && /^1784\d+$/.test(val)
}

async function resolveBusinessAccountId(account: AccountConfig): Promise<string> {
  if (looksIGUserId(account.businessAccountIdOverride)) {
    return account.businessAccountIdOverride!
  }
  if (!account.pageId) {
    throw new Error(`No FACEBOOK_PAGE_ID for ${account.key}`)
  }
  const data = await graph<{ instagram_business_account?: { id: string } }>(account.pageId, account.accessToken!, {
    fields: "instagram_business_account",
  })
  const id = data.instagram_business_account?.id
  if (!id) throw new Error(`No IG business account linked to FB page for ${account.key}`)
  return id
}

interface MediaItem {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  permalink?: string
  thumbnail_url?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

export async function GET(request: NextRequest) {
  return runCronJob("instagram-snapshot", request, async () => {
    const configured = ACCOUNTS.filter((a) => !!a.accessToken && !!a.pageId)
    if (configured.length === 0) {
      return { message: "No Instagram accounts configured", detail: { accounts: 0 } }
    }

    const snapshotDate = new Date().toISOString().split("T")[0]
    const db = getDb()
    const results: Array<{
      key: string
      name: string
      ok: boolean
      error?: string
      mediaCount?: number
      followers?: number
    }> = []

    for (const account of configured) {
      try {
        const igId = await resolveBusinessAccountId(account)

        const profile = await graph<{
          username?: string
          name?: string
          biography?: string
          followers_count?: number
          follows_count?: number
          media_count?: number
          profile_picture_url?: string
        }>(igId, account.accessToken!, {
          fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
        })

        const mediaResp = await graph<{ data: MediaItem[] }>(`${igId}/media`, account.accessToken!, {
          fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
          limit: "25",
        })

        let accountInsights: unknown = null
        try {
          accountInsights = await graph(`${igId}/insights`, account.accessToken!, {
            metric: "reach,profile_views,website_clicks",
            period: "day",
            metric_type: "total_value",
          })
        } catch (insightErr) {
          console.warn(`[cron:instagram-snapshot] ${account.key} insights skipped:`, insightErr)
        }

        const docId = `${account.key}_${snapshotDate}`
        await db
          .collection(SNAPSHOT_COLLECTION)
          .doc(docId)
          .set({
            account: account.key,
            name: account.name,
            instagramBusinessAccountId: igId,
            snapshotDate,
            generatedAt: new Date().toISOString(),
            profile,
            recentMedia: mediaResp.data ?? [],
            accountInsights,
          })

        results.push({
          key: account.key,
          name: account.name,
          ok: true,
          mediaCount: mediaResp.data?.length ?? 0,
          followers: profile.followers_count,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[cron:instagram-snapshot] ${account.key} failed:`, error)
        results.push({ key: account.key, name: account.name, ok: false, error: message })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    const failed = results.length - succeeded

    return {
      message: `${succeeded}/${results.length} IG accounts snapshotted${failed ? `, ${failed} failed` : ""}`,
      detail: { snapshotDate, results },
    }
  })
}

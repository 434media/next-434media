import {
  getLatestInstagramSnapshot,
  getInstagramSnapshotAsOf,
  type InstagramSnapshot,
} from "./analytics-snapshots"
import { pctChange } from "../types/analytics"

// The 4 Instagram accounts the cron snapshots daily. Centralized here so the
// portfolio aggregator and (eventually) the snapshot route can share one source
// of truth — the cron route still owns the env-var bindings.
export const INSTAGRAM_PORTFOLIO_ACCOUNTS = [
  { key: "txmx", name: "TXMX Boxing" },
  { key: "vemos", name: "Vemos Vamos" },
  { key: "milcity", name: "MilCity" },
  { key: "ampd", name: "AMPD Project" },
] as const

export type InstagramRangeKey = "today" | "7d" | "30d" | "90d"

const RANGE_LOOKBACK_DAYS: Record<InstagramRangeKey, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

export interface InstagramPortfolioBrandRow {
  account: string
  name: string
  username?: string
  profilePictureUrl?: string
  followersCount: number
  priorFollowersCount: number
  netFollowerGrowth: number
  followerGrowthChange: number
  mediaCount: number
  mediaAdded: number
  followerShare: number
  snapshotDate?: string
  priorSnapshotDate?: string
  unavailable?: boolean
  error?: string
}

export interface InstagramPortfolioSummary {
  total: {
    followers: number
    mediaCount: number
    netFollowerGrowth: number
  }
  previousPeriod: {
    followers: number
    mediaCount: number
  }
  totalFollowersChange: number
  totalMediaChange: number
  brands: InstagramPortfolioBrandRow[]
  configuredCount: number
  totalCount: number
  generatedAt: string
  rangeKey: InstagramRangeKey
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split("T")[0]
}

function getProfileNumber(profile: Record<string, unknown> | undefined, key: string): number {
  if (!profile) return 0
  const v = profile[key]
  return typeof v === "number" ? v : 0
}

function getProfileString(
  profile: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!profile) return undefined
  const v = profile[key]
  return typeof v === "string" ? v : undefined
}

function unavailableRow(
  account: { key: string; name: string },
  error: string,
): InstagramPortfolioBrandRow {
  return {
    account: account.key,
    name: account.name,
    followersCount: 0,
    priorFollowersCount: 0,
    netFollowerGrowth: 0,
    followerGrowthChange: 0,
    mediaCount: 0,
    mediaAdded: 0,
    followerShare: 0,
    unavailable: true,
    error,
  }
}

// Roll up every Instagram account into a portfolio view. Snapshot-only — reads
// the latest snapshot plus an as-of snapshot N days ago for PoP deltas. Failing
// or missing accounts surface as unavailable rows so the UI shows "no snapshot
// yet" rather than silently dropping them.
export async function getInstagramPortfolioSummary(
  rangeKey: InstagramRangeKey,
): Promise<InstagramPortfolioSummary> {
  const lookbackDays = RANGE_LOOKBACK_DAYS[rangeKey]
  const priorDate = isoDateNDaysAgo(lookbackDays)
  const accounts = INSTAGRAM_PORTFOLIO_ACCOUNTS

  const results = await Promise.allSettled(
    accounts.map(async (a) => {
      const [latest, prior] = await Promise.all([
        getLatestInstagramSnapshot(a.key),
        getInstagramSnapshotAsOf(a.key, priorDate),
      ])
      return { latest, prior }
    }),
  )

  let totalFollowers = 0
  let totalPriorFollowers = 0
  let totalMedia = 0
  let totalPriorMedia = 0
  let totalNetGrowth = 0
  let configuredCount = 0

  const brandRows: InstagramPortfolioBrandRow[] = []

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    const result = results[i]

    if (result.status === "rejected") {
      const reason =
        result.reason instanceof Error ? result.reason.message : String(result.reason)
      brandRows.push(unavailableRow(account, reason))
      continue
    }

    const { latest, prior } = result.value

    if (!latest) {
      brandRows.push(
        unavailableRow(
          account,
          "No snapshot yet — daily cron has not run for this account",
        ),
      )
      continue
    }

    configuredCount++

    const profile = (latest.profile ?? {}) as Record<string, unknown>
    const priorProfile = (prior?.profile ?? null) as Record<string, unknown> | null

    const followers = getProfileNumber(profile, "followers_count")
    const mediaCount = getProfileNumber(profile, "media_count")

    // If there's no prior snapshot yet (e.g. first week of cron), fall back to
    // the current value so deltas read as 0% rather than -100%.
    const priorFollowers = priorProfile
      ? getProfileNumber(priorProfile, "followers_count")
      : followers
    const priorMedia = priorProfile
      ? getProfileNumber(priorProfile, "media_count")
      : mediaCount

    totalFollowers += followers
    totalPriorFollowers += priorFollowers
    totalMedia += mediaCount
    totalPriorMedia += priorMedia
    totalNetGrowth += followers - priorFollowers

    brandRows.push({
      account: account.key,
      name: account.name,
      username: getProfileString(profile, "username"),
      profilePictureUrl: getProfileString(profile, "profile_picture_url"),
      followersCount: followers,
      priorFollowersCount: priorFollowers,
      netFollowerGrowth: followers - priorFollowers,
      followerGrowthChange: pctChange(followers, priorFollowers),
      mediaCount,
      mediaAdded: mediaCount - priorMedia,
      followerShare: 0,
      snapshotDate: latest.snapshotDate,
      priorSnapshotDate: prior?.snapshotDate,
    })
  }

  for (const row of brandRows) {
    if (row.unavailable) continue
    row.followerShare = totalFollowers > 0 ? row.followersCount / totalFollowers : 0
  }

  return {
    total: {
      followers: totalFollowers,
      mediaCount: totalMedia,
      netFollowerGrowth: totalNetGrowth,
    },
    previousPeriod: {
      followers: totalPriorFollowers,
      mediaCount: totalPriorMedia,
    },
    totalFollowersChange: pctChange(totalFollowers, totalPriorFollowers),
    totalMediaChange: pctChange(totalMedia, totalPriorMedia),
    brands: brandRows,
    configuredCount,
    totalCount: accounts.length,
    generatedAt: new Date().toISOString(),
    rangeKey,
  }
}

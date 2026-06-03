"use client"

import { useMemo } from "react"
import { Mail } from "lucide-react"

interface SubscriberMembership {
  status: string
}

interface SubscriberEntry {
  email: string
  memberships: SubscriberMembership[]
}

interface PermissionStateRibbonProps {
  /** Emails to score — typically the currently-filtered submissions list. */
  emails: string[]
  /** subscriberMap from useMailchimpSubscribers (all-status). */
  subscriberMap: Map<string, SubscriberEntry>
}

type Bucket = "subscribed" | "pending" | "opted_out" | "not_opted_in"

// Status dot per bucket — the only visual carried into the one-line summary.
const BUCKET_META: Record<Bucket, { dot: string }> = {
  subscribed: { dot: "bg-emerald-500" },
  pending: { dot: "bg-amber-500" },
  opted_out: { dot: "bg-rose-500" },
  not_opted_in: { dot: "bg-neutral-300" },
}

/**
 * Bucket priority. "Can I email this person today?" — subscribed in any audience
 * wins. Then pending. Opted out (unsubscribed/cleaned) is called out distinctly
 * from "not opted in" (transactional / never synced) so an active opt-out reads
 * differently from someone who simply hasn't consented.
 */
function pickBucket(memberships: SubscriberMembership[]): Bucket {
  if (memberships.some((m) => m.status === "subscribed")) return "subscribed"
  if (memberships.some((m) => m.status === "pending")) return "pending"
  if (memberships.some((m) => m.status === "unsubscribed" || m.status === "cleaned")) {
    return "opted_out"
  }
  return "not_opted_in" // transactional / archived / never synced
}

export function PermissionStateRibbon({ emails, subscriberMap }: PermissionStateRibbonProps) {
  const counts = useMemo(() => {
    const acc: Record<Bucket, number> = { subscribed: 0, pending: 0, opted_out: 0, not_opted_in: 0 }
    for (const e of emails) {
      const entry = subscriberMap.get(e.toLowerCase())
      if (!entry || entry.memberships.length === 0) {
        acc.not_opted_in += 1
        continue
      }
      acc[pickBucket(entry.memberships)] += 1
    }
    return acc
  }, [emails, subscriberMap])

  const total = emails.length
  if (total === 0) return null

  // One quiet line. "Contactable today" leads (it's the number that matters);
  // the other buckets follow only when non-zero, each with its status dot, so
  // the line stays short on a healthy list and the panel/legend is retired.
  const rest: Bucket[] = ["pending", "opted_out", "not_opted_in"]
  const shortLabel: Record<Bucket, string> = {
    subscribed: "contactable today",
    pending: "pending opt-in",
    opted_out: "opted out",
    not_opted_in: "not opted in",
  }

  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap px-1 text-[12px] text-neutral-500">
      <span className="inline-flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
        <span className="font-semibold text-neutral-900 tabular-nums">
          {counts.subscribed.toLocaleString()}
        </span>
        <span>{shortLabel.subscribed}</span>
        <span className="text-neutral-300 tabular-nums">/ {total.toLocaleString()}</span>
      </span>
      {rest.map((key) =>
        counts[key] > 0 ? (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="text-neutral-300" aria-hidden="true">·</span>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${BUCKET_META[key].dot}`} aria-hidden="true" />
            <span className="font-medium text-neutral-700 tabular-nums">{counts[key].toLocaleString()}</span>
            <span>{shortLabel[key]}</span>
          </span>
        ) : null,
      )}
    </div>
  )
}

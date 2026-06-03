"use client"

import { useMemo } from "react"
import { Mail, Clock, Ban, UserPlus } from "lucide-react"

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

const BUCKET_META: Record<
  Bucket,
  { label: string; dot: string; bar: string; icon: typeof Mail; hint: string }
> = {
  subscribed: {
    label: "Can email today",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    icon: Mail,
    hint: "Subscribed in at least one audience",
  },
  pending: {
    label: "Pending opt-in",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    icon: Clock,
    hint: "Awaiting double opt-in confirmation",
  },
  opted_out: {
    label: "Opted out",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    icon: Ban,
    hint: "Unsubscribed or hard-bounced (cleaned)",
  },
  not_opted_in: {
    label: "Not opted in",
    dot: "bg-neutral-300",
    bar: "bg-neutral-300",
    icon: UserPlus,
    hint: "Never subscribed — consented contacts sync to Mailchimp automatically",
  },
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

  const segments: Array<{ key: Bucket; count: number; pct: number }> = (
    ["subscribed", "pending", "opted_out", "not_opted_in"] as Bucket[]
  ).map((key) => ({
    key,
    count: counts[key],
    pct: total > 0 ? (counts[key] / total) * 100 : 0,
  }))

  const subscribedCount = counts.subscribed

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
              Permission state
            </p>
            <p className="text-sm text-neutral-700 tabular-nums">
              <span className="font-semibold text-neutral-900">{subscribedCount.toLocaleString()}</span>{" "}
              of {total.toLocaleString()} contactable today
            </p>
          </div>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="px-4 pb-3">
        <div className="flex h-2 rounded-full overflow-hidden bg-neutral-100">
          {segments.map((seg) =>
            seg.pct > 0 ? (
              <div
                key={seg.key}
                className={BUCKET_META[seg.key].bar}
                style={{ width: `${seg.pct}%` }}
                title={`${BUCKET_META[seg.key].label}: ${seg.count.toLocaleString()} (${seg.pct.toFixed(1)}%)`}
              />
            ) : null,
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {segments.map((seg) => {
            const meta = BUCKET_META[seg.key]
            return (
              <div key={seg.key} className="flex items-start gap-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-neutral-700 truncate">{meta.label}</p>
                  <p className="text-sm text-neutral-900 font-semibold tabular-nums">
                    {seg.count.toLocaleString()}
                    <span className="ml-1 text-[11px] font-normal text-neutral-400">
                      {seg.pct.toFixed(0)}%
                    </span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

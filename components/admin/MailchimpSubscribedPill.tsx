"use client"

import { useEffect, useState } from "react"

export interface AudienceMembership {
  audienceId: string
  audienceName: string
  tags: string[]
  status: string
}

export interface SubscriberEntry {
  email: string
  memberships: AudienceMembership[]
}

export type SubscriberMap = Map<string, SubscriberEntry>

/**
 * True when the contact is `subscribed` (marketable) in at least one audience.
 * Present-but-not-subscribed (transactional / unsubscribed / cleaned / pending)
 * returns false — they exist in Mailchimp but can't receive a campaign today.
 */
export function isMarketable(entry: SubscriberEntry | undefined): boolean {
  return !!entry?.memberships.some((m) => m.status === "subscribed")
}

/**
 * True when the contact actively opted out — unsubscribed or cleaned in
 * Mailchimp, or on the broadcast suppression list (surfaced as a synthetic
 * "unsubscribed" membership by the subscriber-map route). Distinct from
 * "never opted in" (transactional/pending), which is not an opt-out.
 */
export function isOptedOut(entry: SubscriberEntry | undefined): boolean {
  return !!entry?.memberships.some((m) => m.status === "unsubscribed" || m.status === "cleaned")
}

let cachedMap: { map: SubscriberMap; ts: number } | null = null
const CACHE_TTL = 60 * 1000 // 60s — Mailchimp data changes slowly

/**
 * One fetch per page load (60s in-memory cache shared across tab switches).
 * Returns email→memberships keyed by lowercased email. The fetch runs once
 * even if dozens of rows ask for the lookup.
 */
export function useMailchimpSubscribers(): SubscriberMap {
  const [map, setMap] = useState<SubscriberMap>(() => cachedMap?.map ?? new Map())

  useEffect(() => {
    if (cachedMap && Date.now() - cachedMap.ts < CACHE_TTL) {
      setMap(cachedMap.map)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/mailchimp/subscriber-map", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { byEmail?: Record<string, SubscriberEntry> }
        const next: SubscriberMap = new Map()
        for (const [email, entry] of Object.entries(data.byEmail ?? {})) {
          next.set(email.toLowerCase(), entry)
        }
        cachedMap = { map: next, ts: Date.now() }
        if (!cancelled) setMap(next)
      } catch {
        /* silent — pill is non-critical */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return map
}

interface MailchimpSubscribedPillProps {
  email: string | undefined | null
  mapping: SubscriberMap
}

/**
 * Renders a quiet "✉ Subscribed" pill if the email is in any configured
 * Mailchimp audience. Hover reveals which audience(s) and any tags applied.
 * Returns null for non-subscribers — the row stays clean.
 */
export function MailchimpSubscribedPill({ email, mapping }: MailchimpSubscribedPillProps) {
  if (!email) return null
  const entry = mapping.get(email.toLowerCase())
  if (!entry || entry.memberships.length === 0) return null

  // Opt-out takes precedence over a (possibly stale) subscribed membership, so
  // an opt-out is never shown as green.
  const optedOut = isOptedOut(entry)
  const marketable = !optedOut && isMarketable(entry)

  // Tooltip text: full audience names + status + tags
  const tooltipLines = entry.memberships.map((m) => {
    const tagSuffix = m.tags.length > 0 ? ` · tags: ${m.tags.join(", ")}` : ""
    return `${m.audienceName} (${m.status})${tagSuffix}`
  })

  // Rose dot = opted out (unsubscribed/cleaned/suppressed). Green = subscribed.
  // Amber = present in Mailchimp but never subscribed (transactional/pending).
  const dotClass = optedOut ? "bg-rose-500" : marketable ? "bg-emerald-500" : "bg-amber-500"
  const label = optedOut
    ? "opted out"
    : entry.memberships.length === 1
      ? entry.memberships[0].audienceName
      : `${entry.memberships.length} audiences`

  return (
    <span
      title={tooltipLines.join("\n")}
      className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded-sm text-[10px] font-medium text-neutral-700 bg-neutral-100"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
      {!optedOut && (
        <>
          MC<span className="text-neutral-400">·</span>
        </>
      )}
      <span className="truncate max-w-[12ch]">{label}</span>
    </span>
  )
}

"use client"

import { useEffect, useState } from "react"

interface AudienceMembership {
  audienceId: string
  audienceName: string
  tags: string[]
  status: string
}

interface SubscriberEntry {
  email: string
  memberships: AudienceMembership[]
}

type SubscriberMap = Map<string, SubscriberEntry>

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

  const audienceLabel =
    entry.memberships.length === 1
      ? entry.memberships[0].audienceName
      : `${entry.memberships.length} audiences`

  // Tooltip text: full audience names + tags
  const tooltipLines = entry.memberships.map((m) => {
    const tagSuffix = m.tags.length > 0 ? ` · tags: ${m.tags.join(", ")}` : ""
    return `${m.audienceName}${tagSuffix}`
  })

  return (
    <span
      title={tooltipLines.join("\n")}
      className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded-sm text-[10px] font-medium text-neutral-700 bg-neutral-100"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
      MC
      <span className="text-neutral-400">·</span>
      <span className="truncate max-w-[10ch]">{audienceLabel}</span>
    </span>
  )
}

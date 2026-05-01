"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Lead } from "@/types/crm-types"

/**
 * Map of lowercased email → lead id. Built once per page from /api/admin/leads
 * so the cross-link lookup on each row is O(1) instead of N requests.
 */
type EmailToLeadId = Map<string, string>

let cachedMap: { map: EmailToLeadId; ts: number } | null = null
const CACHE_TTL = 30 * 1000

export function useLeadsByEmail(): EmailToLeadId {
  const [map, setMap] = useState<EmailToLeadId>(() => cachedMap?.map ?? new Map())

  useEffect(() => {
    if (cachedMap && Date.now() - cachedMap.ts < CACHE_TTL) {
      setMap(cachedMap.map)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/leads", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as { leads?: Lead[] }
        const next: EmailToLeadId = new Map()
        for (const l of data.leads ?? []) {
          if (l.email) next.set(l.email.toLowerCase(), l.id)
        }
        cachedMap = { map: next, ts: Date.now() }
        if (!cancelled) setMap(next)
      } catch {
        // Silent — cross-link is a nice-to-have, not load-bearing
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return map
}

interface LeadCrossLinkProps {
  email: string | undefined | null
  mapping: EmailToLeadId
  /** Visual style. "pill" = inline tag, "icon" = just an arrow button. */
  variant?: "pill" | "icon"
}

/**
 * Renders a link to the matching lead in the CRM (if one exists for this email).
 * Returns null when there's no match — the row stays clean for non-leads.
 */
export function LeadCrossLink({ email, mapping, variant = "pill" }: LeadCrossLinkProps) {
  if (!email) return null
  const id = mapping.get(email.toLowerCase())
  if (!id) return null

  const href = `/admin/crm?tab=leads&openLead=${encodeURIComponent(id)}`

  if (variant === "icon") {
    return (
      <Link
        href={href}
        title="Open in CRM"
        className="inline-flex items-center justify-center w-5 h-5 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowUpRight className="w-3 h-3" />
      </Link>
    )
  }

  return (
    <Link
      href={href}
      title="Open in CRM"
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 ml-1.5 rounded-full text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100"
      onClick={(e) => e.stopPropagation()}
    >
      CRM
      <ArrowUpRight className="w-2.5 h-2.5" />
    </Link>
  )
}

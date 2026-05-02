"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Combine,
  ChevronDown,
  Loader2,
  Mail,
  MessageSquare,
  Ticket,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  UserPlus,
} from "lucide-react"

type SourceKey = "email_signups" | "contact_forms" | "event_registrations"

interface DupeRow {
  source: SourceKey
  id: string
  sourceSite: string
  created_at: string
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  message?: string
  eventName?: string
  eventDate?: string
}

interface DupeGroup {
  email: string
  name?: string
  company?: string
  crmLeadId?: string
  counts: { email_signups: number; contact_forms: number; event_registrations: number }
  rows: DupeRow[]
  firstSeen: string
  lastSeen: string
  totalRows: number
  distinctSources: number
}

interface DupesResponse {
  ok: boolean
  groups: DupeGroup[]
  stats: {
    totalEmails: number
    duplicateEmails: number
    totalRows: number
    crmCovered: number
  }
}

interface ConvertResult {
  created: number
  updated: number
  failed: number
}

const SOURCE_META: Record<SourceKey, { label: string; icon: typeof Mail; tabSlug: string }> = {
  email_signups: { label: "Newsletter", icon: Mail, tabSlug: "emails" },
  contact_forms: { label: "Contact Form", icon: MessageSquare, tabSlug: "contact-forms" },
  event_registrations: { label: "Event", icon: Ticket, tabSlug: "events" },
}

function formatDate(iso: string): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return ""
  }
}

interface CrossSourceDupesPanelProps {
  /** Notify the parent (page) so it can show a toast — keeps toast styling unified. */
  onToast?: (message: string, type: "success" | "error") => void
}

/**
 * Collapsible panel that surfaces emails appearing in 2+ submission collections.
 * Renders above the Submissions tabs. Each group offers a one-click "Convert to
 * CRM" that fires per-source POSTs to bulk-convert-leads — the helpers dedupe
 * by email, so the lead ends up tagged with every source it appeared in.
 */
export function CrossSourceDupesPanel({ onToast }: CrossSourceDupesPanelProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<DupesResponse | null>(null)
  const [convertingEmail, setConvertingEmail] = useState<string | null>(null)
  // Local override so a freshly-converted group flips its pill without a full refetch.
  const [justConverted, setJustConverted] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/admin/submissions/cross-source-dupes", { cache: "no-store" })
      if (!res.ok) {
        setData(null)
        return
      }
      const json = (await res.json()) as DupesResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const groups = data?.groups ?? []
  const stats = data?.stats

  // Hide entirely when there are no dupes — the page is already busy.
  if (!isLoading && groups.length === 0) return null

  async function convertGroup(group: DupeGroup) {
    setConvertingEmail(group.email)
    try {
      // Bucket rows by source; one POST per source. Existing leads get tag-merged.
      const buckets: Record<SourceKey, DupeRow[]> = {
        email_signups: [],
        contact_forms: [],
        event_registrations: [],
      }
      for (const r of group.rows) buckets[r.source].push(r)

      const totals: ConvertResult = { created: 0, updated: 0, failed: 0 }

      for (const source of Object.keys(buckets) as SourceKey[]) {
        const rows = buckets[source]
        if (rows.length === 0) continue
        const items = rows.map((r) => ({
          id: r.id,
          email: group.email,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          phone: r.phone,
          message: r.message,
          sourceSite: r.sourceSite,
          eventName: r.eventName,
          eventDate: r.eventDate,
        }))
        const res = await fetch("/api/admin/submissions/bulk-convert-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, items }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.ok) {
          totals.failed += rows.length
          continue
        }
        totals.created += body.result.created
        totals.updated += body.result.updated
        totals.failed += body.result.failed
      }

      if (totals.failed === 0) {
        setJustConverted((prev) => new Set(prev).add(group.email))
        onToast?.(
          `${group.email}: ${totals.created} new, ${totals.updated} updated across ${group.distinctSources} sources`,
          "success",
        )
      } else {
        onToast?.(`${group.email}: ${totals.failed} failed`, "error")
      }
    } catch {
      onToast?.(`Convert failed for ${group.email}`, "error")
    } finally {
      setConvertingEmail(null)
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden mb-4">
      <div className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <Combine className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 shrink-0">
            Cross-source duplicates
          </span>
          <span className="text-[10px] text-neutral-400 truncate">
            {isLoading ? (
              "scanning…"
            ) : stats ? (
              <>
                {stats.duplicateEmails} {stats.duplicateEmails === 1 ? "person" : "people"} in 2+ tabs ·{" "}
                {stats.totalRows} total submissions
                {stats.duplicateEmails > 0 ? (
                  <>
                    {" "}
                    · {stats.crmCovered} already in CRM
                  </>
                ) : null}
              </>
            ) : null}
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {!isLoading && (
            <button
              type="button"
              onClick={load}
              className="p-1 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-neutral-400">
              No cross-source duplicates right now.
            </div>
          ) : (
            <ul className="max-h-112 overflow-y-auto divide-y divide-neutral-100">
              {groups.map((g) => {
                const isCrm = !!g.crmLeadId || justConverted.has(g.email)
                const isConverting = convertingEmail === g.email
                return (
                  <li key={g.email} className="px-4 py-3 hover:bg-neutral-50/40 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Left: identity */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-neutral-900 truncate">
                            {g.email}
                          </span>
                          {g.name && (
                            <span className="text-[12px] text-neutral-500 truncate">{g.name}</span>
                          )}
                          {g.company && (
                            <span className="text-[11px] text-neutral-400 truncate">· {g.company}</span>
                          )}
                          {isCrm && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-[10px] font-medium text-emerald-700">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              In CRM
                            </span>
                          )}
                        </div>
                        {/* Source chips */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {(Object.keys(SOURCE_META) as SourceKey[]).map((src) => {
                            const count = g.counts[src]
                            if (count === 0) return null
                            const Meta = SOURCE_META[src]
                            const Icon = Meta.icon
                            return (
                              <Link
                                key={src}
                                href={`/admin/leads?tab=${Meta.tabSlug}&search=${encodeURIComponent(g.email)}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-100 hover:bg-neutral-200 transition-colors text-[10px] font-medium text-neutral-700"
                                title={`Filter ${Meta.label} tab to this email`}
                              >
                                <Icon className="w-2.5 h-2.5" />
                                {Meta.label}
                                <span className="text-neutral-500 tabular-nums">×{count}</span>
                              </Link>
                            )
                          })}
                          <span className="text-[10px] text-neutral-400 ml-1">
                            first {formatDate(g.firstSeen)} · last {formatDate(g.lastSeen)}
                          </span>
                        </div>
                      </div>
                      {/* Right: action */}
                      <div className="shrink-0">
                        {isCrm ? (
                          g.crmLeadId ? (
                            <Link
                              href={`/admin/crm?tab=leads&openLead=${encodeURIComponent(g.crmLeadId)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
                            >
                              View lead
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            // justConverted but no leadId yet — refresh to pick it up
                            <button
                              type="button"
                              onClick={load}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md hover:bg-emerald-100 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Converted
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => convertGroup(g)}
                            disabled={isConverting}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isConverting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            Merge into CRM
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50 text-[11px] text-neutral-400">
            One person, multiple touchpoints. Merging captures every source as a tag on a single CRM lead so
            scoring and follow-up stay aligned.
          </div>
        </div>
      )}
    </div>
  )
}

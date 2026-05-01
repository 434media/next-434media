"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Loader2,
  Mail,
  FileText,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Target,
  AlertTriangle,
  Clock,
  Activity,
  UserPlus,
  Send,
  ExternalLink,
} from "lucide-react"
import type { Customer360, TimelineEntry, TimelineEntryKind } from "@/lib/customer-360"

const BRAND_TO_IG_ACCOUNT: Record<string, string> = {
  "TXMX Boxing": "txmx",
  "Vemos Vamos": "vemos",
  "Digital Canvas": "milcity",
  "434 Media": "txmx",
}

interface Customer360PanelProps {
  clientId: string
}

function fmtCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

const TIMELINE_ICONS: Record<TimelineEntryKind, { icon: typeof Mail; color: string; bg: string }> = {
  client_created: { icon: UserPlus, color: "text-neutral-700", bg: "bg-neutral-100" },
  email_signup: { icon: Mail, color: "text-blue-700", bg: "bg-blue-50" },
  contact_form: { icon: Send, color: "text-amber-700", bg: "bg-amber-50" },
  mailchimp_signup: { icon: Mail, color: "text-pink-700", bg: "bg-pink-50" },
  opportunity_created: { icon: Target, color: "text-emerald-700", bg: "bg-emerald-50" },
  opportunity_stage_change: { icon: Activity, color: "text-emerald-700", bg: "bg-emerald-50" },
  opportunity_won: { icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-50" },
  opportunity_lost: { icon: TrendingDown, color: "text-rose-700", bg: "bg-rose-50" },
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Mail
  tone?: "neutral" | "emerald" | "teal" | "blue" | "amber"
}) {
  const tones = {
    neutral: "border-neutral-200 bg-white",
    emerald: "border-emerald-200 bg-emerald-50/40",
    teal: "border-teal-200 bg-teal-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    amber: "border-amber-200 bg-amber-50/40",
  }
  return (
    <div className={`rounded-lg border ${tones[tone]} p-3`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-neutral-900 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const cfg = TIMELINE_ICONS[entry.kind] ?? TIMELINE_ICONS.client_created
  const Icon = cfg.icon
  return (
    <div className="flex gap-3 py-2.5 border-b border-neutral-100 last:border-b-0">
      <div className={`shrink-0 w-8 h-8 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-semibold text-neutral-800 truncate">{entry.title}</div>
          <div className="text-[11px] text-neutral-400 shrink-0">{fmtDateTime(entry.at)}</div>
        </div>
        {entry.detail && <div className="text-[12px] text-neutral-500 mt-0.5 line-clamp-2">{entry.detail}</div>}
      </div>
    </div>
  )
}

export function Customer360Panel({ clientId }: Customer360PanelProps) {
  const [data, setData] = useState<Customer360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/admin/crm/clients/${clientId}/360`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((body) => {
        if (cancelled) return
        if (!body.success) throw new Error(body.error || "Failed to load")
        setData(body.data as Customer360)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load Customer 360")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading Customer 360…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Failed to load Customer 360</div>
          <div className="text-[12px] mt-0.5">{error}</div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { client, summary, opportunities, mailchimpSubscribers, emailSignups, contactForms, timeline, warnings, emails } =
    data

  const igAccount = client.brand ? BRAND_TO_IG_ACCOUNT[client.brand] : null
  const ga4PropertyMap: Record<string, string> = {
    "TXMX Boxing": "492867424",
    "Vemos Vamos": "492895637",
    "Digital Canvas": "492925088",
    "434 Media": "488543948",
  }
  const ga4Property = client.brand ? ga4PropertyMap[client.brand] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="text-sm text-neutral-500">
          <span className="font-semibold text-neutral-800">First seen</span> {fmtDate(summary.firstSeen)}
        </div>
        <div className="text-sm text-neutral-500">
          <span className="font-semibold text-neutral-800">Last touch</span> {fmtDate(summary.lastTouch)}
        </div>
        {emails.length > 0 && (
          <div className="text-[12px] text-neutral-400">
            Joined on {emails.length} {emails.length === 1 ? "email" : "emails"}
          </div>
        )}
      </div>

      {/* Cross-section quick links */}
      {(emails.length > 0 || igAccount || ga4Property) && (
        <div className="flex flex-wrap gap-2">
          {emails.length > 0 && (
            <Link
              href={`/admin/leads?tab=emails&search=${encodeURIComponent(emails[0])}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-medium hover:bg-blue-100 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email signups in Leads
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          )}
          {emails.length > 0 && summary.contactFormCount > 0 && (
            <Link
              href={`/admin/leads?tab=contact-forms&search=${encodeURIComponent(emails[0])}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-medium hover:bg-amber-100 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Form submissions
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          )}
          {igAccount && (
            <Link
              href={`/admin/analytics-instagram?account=${igAccount}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pink-50 border border-pink-200 text-pink-700 text-[12px] font-medium hover:bg-pink-100 transition-colors"
            >
              {client.brand} on Instagram
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          )}
          {ga4Property && (
            <Link
              href={`/admin/analytics-web?propertyId=${ga4Property}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium hover:bg-emerald-100 transition-colors"
            >
              {client.brand} web analytics
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile
          label="Open pipeline"
          value={fmtCurrency(summary.pipelineValue)}
          sub={`${summary.opportunitiesOpen} ${summary.opportunitiesOpen === 1 ? "deal" : "deals"}`}
          icon={Target}
          tone="teal"
        />
        <StatTile
          label="Won"
          value={fmtCurrency(summary.wonValue)}
          sub={`${summary.opportunitiesWon} ${summary.opportunitiesWon === 1 ? "deal" : "deals"}`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatTile
          label="Email signups"
          value={summary.emailSignupCount}
          sub={summary.mailchimpSubscriptions ? `${summary.mailchimpSubscriptions} Mailchimp lists` : "Not subscribed"}
          icon={Mail}
          tone="blue"
        />
        <StatTile
          label="Contact forms"
          value={summary.contactFormCount}
          sub={summary.contactFormCount === 0 ? "No submissions" : "Form submissions"}
          icon={FileText}
          tone="amber"
        />
      </div>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[12px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Partial data</div>
            <ul className="space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-4 h-4 text-neutral-500" />
          <h3 className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wide">Timeline</h3>
          <span className="text-[11px] text-neutral-400">({timeline.length} events)</span>
        </div>
        {timeline.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-[13px] text-neutral-400">
            No engagement events yet
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white px-3 max-h-105 overflow-y-auto">
            {timeline.map((entry, i) => (
              <TimelineRow key={`${entry.kind}-${i}`} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Mailchimp subscriptions */}
      {mailchimpSubscribers.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wide mb-2">
            Mailchimp subscriptions
          </h3>
          <div className="space-y-2">
            {mailchimpSubscribers.map((m, i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-200 bg-white p-3 text-[12px] flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-800">{m.audienceName || m.audienceId}</div>
                  <div className="text-neutral-500">{m.email}</div>
                  {m.tags && m.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.tags.map((t, ti) => (
                        <span
                          key={ti}
                          className="inline-block px-1.5 py-0.5 rounded bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-medium"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                      m.status === "subscribed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {m.status}
                  </span>
                  <div className="text-neutral-400 text-[10px] mt-1">since {fmtDate(m.timestampSignup)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wide mb-2">Opportunities</h3>
          <div className="space-y-1.5">
            {opportunities.map((o) => (
              <div
                key={o.id}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 flex items-center justify-between gap-3 text-[12px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-800 truncate">
                    {o.name || `${o.stage} opportunity`}
                  </div>
                  <div className="text-neutral-500">{o.stage}</div>
                </div>
                <div className="shrink-0 text-right font-semibold text-neutral-800">
                  {o.value ? fmtCurrency(o.value) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact form submissions */}
      {contactForms.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wide mb-2">
            Contact form submissions
          </h3>
          <div className="space-y-2">
            {contactForms.slice(0, 5).map((f) => (
              <div key={f.id} className="rounded-lg border border-neutral-200 bg-white p-3 text-[12px]">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="font-semibold text-neutral-800">
                    {f.firstName} {f.lastName} {f.company && <span className="text-neutral-400">· {f.company}</span>}
                  </div>
                  <div className="text-[11px] text-neutral-400">{fmtDate(f.created_at)}</div>
                </div>
                {f.message && <div className="text-neutral-500 line-clamp-3">{f.message}</div>}
                <div className="text-[10px] text-neutral-400 mt-1 uppercase tracking-wide">{f.source}</div>
              </div>
            ))}
            {contactForms.length > 5 && (
              <div className="text-[11px] text-neutral-400 text-center">
                + {contactForms.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email signups (raw) */}
      {emailSignups.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-neutral-800 uppercase tracking-wide mb-2">Email signups</h3>
          <div className="rounded-lg border border-neutral-200 bg-white divide-y divide-neutral-100">
            {emailSignups.slice(0, 8).map((s) => (
              <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-neutral-700 truncate">{s.email}</div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wide">{s.source}</div>
                </div>
                <div className="shrink-0 text-[11px] text-neutral-400">{fmtDate(s.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

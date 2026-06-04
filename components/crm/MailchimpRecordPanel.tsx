"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Mail,
  MailOpen,
  MousePointerClick,
  Tag as TagIcon,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  Send,
  UserMinus,
  UserPlus,
} from "lucide-react"

interface AudienceProfile {
  audienceId: string
  audienceName: string
  status: string
  tags: Array<{ id: number; name: string }>
  rating?: number
  timestampSignup?: string
  timestampOpt?: string
  lastChanged?: string
  emailClient?: string
  language?: string
  source?: string
  mergeFields?: Record<string, string | number | null>
}

interface ActivityEvent {
  audienceId: string
  audienceName: string
  action: string
  timestamp: string
  campaignId?: string
  campaignTitle?: string
  url?: string
}

interface MemberLookup {
  email: string
  found: boolean
  audiences: AudienceProfile[]
  activity: ActivityEvent[]
  generatedAt: string
}

/** Consent verdict for the lead, derived from their Mailchimp membership. */
export type LeadConsent = "subscribed" | "pending" | "opted_out" | "not_in_mailchimp"

interface MailchimpRecordPanelProps {
  email: string | undefined
  /** Reports the consent verdict up to the parent once the member loads, so the
   *  outreach Send block can surface it and gate on a marketing opt-out. Pass a
   *  stable callback (e.g. a useState setter) — it's read in an effect. */
  onConsentResolved?: (state: LeadConsent) => void
}

const STATUS_DOT: Record<string, string> = {
  subscribed: "bg-emerald-500",
  pending: "bg-amber-500",
  unsubscribed: "bg-neutral-400",
  cleaned: "bg-red-500",
  archived: "bg-neutral-300",
  transactional: "bg-blue-500",
}

function statusDot(status: string): string {
  return STATUS_DOT[status] || "bg-neutral-300"
}

function actionIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes("open")) return MailOpen
  if (a.includes("click")) return MousePointerClick
  if (a.includes("sent") || a.includes("send")) return Send
  if (a.includes("unsub")) return UserMinus
  return Mail
}

function formatRelative(iso: string): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diffMs = Date.now() - t
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return "just now"
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.round(hr / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function humanizeAction(action: string): string {
  const a = action.toLowerCase()
  if (a === "sent") return "Received"
  if (a === "open") return "Opened"
  if (a === "click") return "Clicked"
  if (a === "bounce") return "Bounced"
  if (a === "unsub") return "Unsubscribed"
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export function MailchimpRecordPanel({ email, onConsentResolved }: MailchimpRecordPanelProps) {
  const [data, setData] = useState<MemberLookup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState("")
  const [tagSaving, setTagSaving] = useState<string | null>(null)
  const [tagAudienceId, setTagAudienceId] = useState<string>("")
  const [showAllActivity, setShowAllActivity] = useState(false)

  const normalizedEmail = (email || "").trim().toLowerCase()

  const load = useMemo(
    () => async (signal?: AbortSignal) => {
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        setData(null)
        return
      }
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/mailchimp/member?email=${encodeURIComponent(normalizedEmail)}`, {
          signal,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load Mailchimp data")
        setData(json.data as MemberLookup)
        // Default the tag-add audience to the first one we find this email in
        if (!tagAudienceId && json.data?.audiences?.length > 0) {
          setTagAudienceId(json.data.audiences[0].audienceId)
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to load Mailchimp data")
      } finally {
        setIsLoading(false)
      }
    },
    [normalizedEmail, tagAudienceId],
  )

  useEffect(() => {
    const ctl = new AbortController()
    load(ctl.signal)
    return () => ctl.abort()
  }, [load])

  // Report the consent verdict up once the member resolves. Subscribed in any
  // audience wins; then pending; an unsubscribe/clean is a marketing opt-out.
  useEffect(() => {
    if (!data) return
    let verdict: LeadConsent = "not_in_mailchimp"
    if (data.found) {
      const statuses = data.audiences.map((a) => a.status)
      if (statuses.includes("subscribed")) verdict = "subscribed"
      else if (statuses.includes("pending")) verdict = "pending"
      else if (statuses.some((s) => s === "unsubscribed" || s === "cleaned")) verdict = "opted_out"
    }
    onConsentResolved?.(verdict)
  }, [data, onConsentResolved])

  if (!normalizedEmail) return null

  const found = data?.found ?? false
  const audiences = data?.audiences ?? []
  const activity = data?.activity ?? []
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 5)

  const addTag = async () => {
    const name = tagDraft.trim()
    if (!name || !tagAudienceId) return
    setTagSaving(name)
    try {
      const res = await fetch("/api/admin/mailchimp/member-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: tagAudienceId, email: normalizedEmail, tagName: name, state: "active" }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Failed to add tag")
      }
      setTagDraft("")
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag")
    } finally {
      setTagSaving(null)
    }
  }

  const removeTag = async (audienceId: string, name: string) => {
    setTagSaving(name)
    try {
      const res = await fetch("/api/admin/mailchimp/member-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId, email: normalizedEmail, tagName: name, state: "inactive" }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Failed to remove tag")
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove tag")
    } finally {
      setTagSaving(null)
    }
  }

  return (
    <div className="bg-white rounded-md border border-neutral-200/70 overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-neutral-900 font-medium text-sm">Mailchimp</h3>
            <p className="text-neutral-500 text-xs truncate">{normalizedEmail}</p>
          </div>
        </div>
        <button
          onClick={() => load()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-200/70 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          aria-label="Refresh Mailchimp data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-red-200 bg-red-50">
            <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {isLoading && !data && (
          <div className="space-y-2">
            <div className="h-12 rounded-md bg-neutral-100 animate-pulse" />
            <div className="h-8 rounded-md bg-neutral-100 animate-pulse" />
            <div className="h-20 rounded-md bg-neutral-100 animate-pulse" />
          </div>
        )}

        {/* Not in Mailchimp */}
        {!isLoading && data && !found && (
          <div className="text-center py-6">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
              <UserPlus className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-neutral-900 mb-1">Not in any Mailchimp audience</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Only opted-in contacts sync to Mailchimp (automatically, on consent) — there&apos;s no manual
              add, which keeps Mailchimp the single source of consent. They&apos;ll appear here once they opt
              in or engage a campaign.
            </p>
          </div>
        )}

        {/* Per-audience profile cards */}
        {found && (
          <div className="space-y-3">
            {audiences.map((aud) => {
              const isSubscribed = aud.status === "subscribed"
              return (
                <div key={aud.audienceId} className="rounded-md border border-neutral-200/70 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(aud.status)}`}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium text-neutral-900 truncate">{aud.audienceName}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-[0.16em] bg-neutral-100 text-neutral-700 border border-neutral-200/70 shrink-0">
                      {aud.status}
                    </span>
                  </div>

                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5">
                    {aud.tags.length === 0 ? (
                      <span className="text-[11px] text-neutral-400">No tags</span>
                    ) : (
                      aud.tags.map((t) => (
                        <span
                          key={`${aud.audienceId}-${t.id}-${t.name}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-200/70 bg-white text-[11px] text-neutral-700"
                        >
                          <TagIcon className="w-2.5 h-2.5 text-neutral-400" />
                          {t.name}
                          {isSubscribed && (
                            <button
                              onClick={() => removeTag(aud.audienceId, t.name)}
                              disabled={tagSaving === t.name}
                              className="ml-0.5 p-0.5 -mr-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-50"
                              aria-label={`Remove tag ${t.name}`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500 tabular-nums">
                    {aud.timestampSignup && <span>Joined {formatRelative(aud.timestampSignup)}</span>}
                    {aud.lastChanged && <span>· Updated {formatRelative(aud.lastChanged)}</span>}
                  </div>
                </div>
              )
            })}

            {/* Inline add tag */}
            {audiences.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                {audiences.length > 1 && (
                  <select
                    value={tagAudienceId}
                    onChange={(e) => setTagAudienceId(e.target.value)}
                    className="h-8 px-2 rounded-md border border-neutral-200/70 bg-white text-xs text-neutral-700 focus:border-neutral-400 focus:outline-none"
                    aria-label="Audience for tag"
                  >
                    {audiences.map((a) => (
                      <option key={a.audienceId} value={a.audienceId}>
                        {a.audienceName}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Add a tag…"
                  className="flex-1 h-8 px-3 rounded-md border border-neutral-200/70 bg-white text-xs text-neutral-900 focus:border-neutral-400 focus:outline-none"
                />
                <button
                  onClick={addTag}
                  disabled={!tagDraft.trim() || !tagAudienceId || !!tagSaving}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            )}
          </div>
        )}

        {/* Activity feed */}
        {found && activity.length > 0 && (
          <div className="pt-2 border-t border-neutral-100">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              Recent activity
            </p>
            <ul className="space-y-1.5">
              {visibleActivity.map((ev, i) => {
                const Icon = actionIcon(ev.action)
                return (
                  <li
                    key={`${ev.timestamp}-${i}`}
                    className="flex items-start gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-50 transition-colors"
                  >
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0 mt-0.5">
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-900">
                        <span className="font-medium">{humanizeAction(ev.action)}</span>
                        {ev.campaignTitle && (
                          <span className="text-neutral-500"> · {ev.campaignTitle}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-neutral-400 tabular-nums">
                        {formatRelative(ev.timestamp)}
                        {audiences.length > 1 && ` · ${ev.audienceName}`}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
            {activity.length > 5 && (
              <button
                onClick={() => setShowAllActivity((v) => !v)}
                className="w-full mt-2 py-1.5 text-[11px] text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                {showAllActivity ? "Show less" : `Show all ${activity.length} events`}
              </button>
            )}
          </div>
        )}

        {/* Subscribed but empty activity */}
        {found && activity.length === 0 && !isLoading && (
          <p className="text-[11px] text-neutral-400 text-center pt-2 border-t border-neutral-100">
            No campaign activity yet
          </p>
        )}
      </div>
    </div>
  )
}

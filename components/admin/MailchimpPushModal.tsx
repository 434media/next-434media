"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail, X, Check, AlertCircle, Tag as TagIcon, Send } from "lucide-react"

export interface PushMember {
  email: string
  firstName?: string
  lastName?: string
}

interface MailchimpAudience {
  id: string
  name: string
}

interface MailchimpTag {
  id: string | number
  name: string
}

interface PushResult {
  attempted: number
  newMembers: number
  updatedMembers: number
  errors: Array<{ email: string; code: string; message: string }>
}

interface MailchimpPushModalProps {
  open: boolean
  onClose: () => void
  /** Members to push — caller builds this from selected rows. */
  members: PushMember[]
  /** Optional default tag suggestion (e.g. "from-website-2026-may"). */
  defaultTag?: string
  onComplete?: (result: PushResult) => void
}

type Status = "subscribed" | "pending"

export function MailchimpPushModal({
  open,
  onClose,
  members,
  defaultTag,
  onComplete,
}: MailchimpPushModalProps) {
  const [audiences, setAudiences] = useState<MailchimpAudience[]>([])
  const [existingTags, setExistingTags] = useState<MailchimpTag[]>([])
  const [audienceId, setAudienceId] = useState("")
  const [tags, setTags] = useState<string[]>(defaultTag ? [defaultTag] : [])
  const [tagInput, setTagInput] = useState("")
  const [status, setStatus] = useState<Status>("subscribed")
  const [isLoading, setIsLoading] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PushResult | null>(null)

  // Load audiences + existing tags when modal opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      setResult(null)
      try {
        const [audRes, tagsRes] = await Promise.all([
          fetch("/api/mailchimp?endpoint=properties"),
          fetch("/api/mailchimp?endpoint=tags"),
        ])
        if (!cancelled) {
          if (audRes.ok) {
            const data = await audRes.json()
            // Route wraps in { success, data, timestamp } — handle both wrapped
            // and unwrapped shapes for backward compatibility.
            const list = (data?.data?.properties ?? data?.properties ?? data ?? []) as MailchimpAudience[]
            setAudiences(list)
            // Default to first audience if none picked
            if (list.length > 0 && !audienceId) setAudienceId(list[0].id)
          }
          if (tagsRes.ok) {
            const data = await tagsRes.json()
            setExistingTags((data?.data?.tags ?? data?.tags ?? []) as MailchimpTag[])
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const addTag = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (tags.includes(t)) return
    setTags([...tags, t])
    setTagInput("")
  }

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const handlePush = async () => {
    if (!audienceId) {
      setError("Pick an audience")
      return
    }
    if (members.length === 0) {
      setError("No members to push")
      return
    }
    setIsPushing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/mailchimp/push-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId, status, tags, members }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Push failed")
      }
      setResult(data.result as PushResult)
      onComplete?.(data.result as PushResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push failed")
    } finally {
      setIsPushing(false)
    }
  }

  const handleClose = () => {
    if (isPushing) return // prevent close mid-flight
    setResult(null)
    setError(null)
    onClose()
  }

  if (!open) return null

  // Quick-pick suggestions: top 8 most-used existing tags by member count
  const tagSuggestions = existingTags
    .filter((t) => !tags.includes(t.name))
    .slice(0, 8)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
          <Mail className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Push to Mailchimp</h2>
          <span className="text-[11px] text-neutral-500 ml-1">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
          <button
            type="button"
            onClick={handleClose}
            disabled={isPushing}
            className="ml-auto text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            // ============ Result view ============
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">Push complete</p>
                  <p className="text-[12px] text-emerald-800 mt-0.5">
                    {result.newMembers} added · {result.updatedMembers} already existed (tags
                    updated){result.errors.length > 0 ? ` · ${result.errors.length} failed` : ""}
                  </p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-[11px] font-semibold uppercase tracking-wider text-red-700">
                    Errors ({result.errors.length})
                  </div>
                  <ul className="max-h-40 overflow-y-auto divide-y divide-neutral-100">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i} className="px-3 py-2 text-[12px]">
                        <span className="font-mono text-neutral-700">{e.email}</span>
                        <span className="text-red-600 ml-2">{e.message}</span>
                      </li>
                    ))}
                    {result.errors.length > 20 && (
                      <li className="px-3 py-2 text-[11px] text-neutral-400">
                        +{result.errors.length - 20} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            // ============ Form view ============
            <>
              {/* Audience picker */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Audience
                </label>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-neutral-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading audiences…
                  </div>
                ) : audiences.length === 0 ? (
                  <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    No Mailchimp audiences configured. Set MAILCHIMP_AUDIENCE_ID_* env vars.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {audiences.map((a) => (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          audienceId === a.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="audience"
                          checked={audienceId === a.id}
                          onChange={() => setAudienceId(a.id)}
                          className="text-emerald-600"
                        />
                        <span className="text-[13px] font-medium text-neutral-900">{a.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 border border-neutral-200 rounded-lg bg-white min-h-[40px]">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-[11px] text-neutral-700"
                    >
                      <TagIcon className="w-3 h-3 text-neutral-400" />
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="text-neutral-400 hover:text-neutral-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addTag(tagInput)
                      }
                    }}
                    onBlur={() => addTag(tagInput)}
                    placeholder={tags.length === 0 ? "Add tag…" : ""}
                    className="flex-1 min-w-[80px] text-[12px] bg-transparent focus:outline-none"
                  />
                </div>
                {tagSuggestions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[10px] text-neutral-400 mr-1">Suggested:</span>
                    {tagSuggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addTag(t.name)}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                      >
                        + {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Subscription status
                </label>
                <div className="space-y-1">
                  <label className="flex items-start gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:border-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "subscribed"}
                      onChange={() => setStatus("subscribed")}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-neutral-900">Subscribed</div>
                      <div className="text-[11px] text-neutral-500">
                        Use when these contacts have already consented to email (newsletter signup,
                        contact form with consent checkbox).
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 px-3 py-2 rounded-lg border border-neutral-200 hover:border-neutral-300 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === "pending"}
                      onChange={() => setStatus("pending")}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-neutral-900">
                        Pending — sends double opt-in email
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Mailchimp emails the contact to confirm. Use when consent is unclear.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
          {result ? (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isPushing}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePush}
                disabled={isPushing || isLoading || !audienceId || members.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPushing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pushing…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Push {members.length} {members.length === 1 ? "member" : "members"}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

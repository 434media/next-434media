"use client"

import { useEffect, useState } from "react"
import { ArrowRightCircle, Loader2 } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { LeadSource } from "@/types/crm-types"
import type { AudienceCollection, PromoteOverrides } from "./usePromoteToLeads"

const SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: "partner", label: "Partner" },
  { value: "event", label: "Event" },
  { value: "newsletter", label: "Newsletter" },
  { value: "web", label: "Web (contact form)" },
  { value: "referral", label: "Referral" },
  { value: "social", label: "Social" },
  { value: "prospected", label: "Prospected (Apollo)" },
  { value: "manual", label: "Manual" },
]

const COLLECTION_LABEL: Record<AudienceCollection, string> = {
  partner_list_members: "partner list members",
  event_registrations: "event registrations",
  email_signups: "newsletter subscribers",
  contact_forms: "contact form submissions",
}

interface PromoteOverridesDrawerProps {
  open: boolean
  onClose: () => void
  /** Number of audience rows about to be promoted (for the "Promoting N…" header). */
  count: number
  /** Drives the noun in the header text. */
  collection: AudienceCollection
  /** Source the endpoint will use if no override is set. Pre-fills the dropdown. */
  defaultSource: LeadSource
  /** Disables the confirm button while the parent's mutation is in flight. */
  isPromoting: boolean
  /** Called when the user confirms. Parent triggers the actual promote. */
  onConfirm: (overrides: PromoteOverrides) => Promise<void> | void
}

/**
 * Pre-promote review/override drawer. Surfaced from bulk Promote actions so
 * the user can adjust source/tags/notes once and have those overrides applied
 * across the whole batch. Per-row promotes still go direct.
 *
 * The defaults always reflect the collection's natural source — clicking
 * "Promote" without changing anything matches the v1 direct-promote behavior.
 */
export function PromoteOverridesDrawer({
  open,
  onClose,
  count,
  collection,
  defaultSource,
  isPromoting,
  onConfirm,
}: PromoteOverridesDrawerProps) {
  const [source, setSource] = useState<LeadSource>(defaultSource)
  const [tagsInput, setTagsInput] = useState("")
  const [noteAddendum, setNoteAddendum] = useState("")

  // Reset to defaults whenever the drawer opens (or the collection changes)
  // so a previous session's overrides don't leak into the next batch.
  useEffect(() => {
    if (open) {
      setSource(defaultSource)
      setTagsInput("")
      setNoteAddendum("")
    }
  }, [open, defaultSource])

  const parsedTags = tagsInput
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)

  const handleConfirm = async () => {
    const overrides: PromoteOverrides = {}
    if (source !== defaultSource) overrides.overrideSource = source
    if (parsedTags.length > 0) overrides.extraTags = parsedTags
    if (noteAddendum.trim()) overrides.noteAddendum = noteAddendum.trim()
    await onConfirm(overrides)
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      width="md"
      title={
        <span className="flex items-center gap-2">
          <ArrowRightCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          Promote to leads
        </span>
      }
      subtitle={`${count} ${count === 1 ? "contact" : "contacts"} from ${COLLECTION_LABEL[collection]}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPromoting}
            className="px-3 py-1.5 text-[13px] font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPromoting || count === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {isPromoting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRightCircle className="w-3.5 h-3.5" />
            )}
            Promote {count > 0 ? count : ""}
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-5 space-y-5">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as LeadSource)}
            disabled={isPromoting}
            className="w-full px-3 py-2 text-[13px] bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 disabled:opacity-50"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {opt.value === defaultSource ? " (default)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-400">
            Drives lead scoring + the source label on the lead card.
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Extra tags
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            disabled={isPromoting}
            placeholder="priority:high, campaign:q2-outreach"
            className="w-full px-3 py-2 text-[13px] bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 disabled:opacity-50"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Comma- or newline-separated. Appended to each new lead&apos;s tags. Use namespaced form.
          </p>
          {parsedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {parsedTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Note addendum
          </label>
          <textarea
            value={noteAddendum}
            onChange={(e) => setNoteAddendum(e.target.value)}
            disabled={isPromoting}
            rows={3}
            placeholder="Optional context — appended to each lead's notes."
            className="w-full px-3 py-2 text-[13px] bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 disabled:opacity-50 resize-y"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Goes on every lead in this batch. The auto-generated import &amp; promote receipts are kept either way.
          </p>
        </div>

        <div className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-50 border border-neutral-200/70 rounded-md p-3">
          <strong className="text-neutral-600">Heads up:</strong> contacts already in the leads pipeline (matched by email) will be{" "}
          <em>linked</em> to their existing lead rather than duplicated. Already-promoted rows are skipped silently.
        </div>
      </div>
    </DetailDrawer>
  )
}

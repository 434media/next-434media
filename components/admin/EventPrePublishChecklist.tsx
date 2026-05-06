"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react"
import type { PMEvent } from "@/types/project-management-types"

interface EventPrePublishChecklistProps {
  /** Form snapshot — partial because it may be in mid-edit. */
  formData: Partial<PMEvent>
}

interface ChecklistIssue {
  id: string
  severity: "warn" | "info"
  label: string
  detail: string
}

function computeIssues(form: Partial<PMEvent>): ChecklistIssue[] {
  const issues: ChecklistIssue[] = []

  // Required-ish fields for a confirmed event — these become more likely to
  // bite as the event approaches launch
  if (!form.venue_name?.trim()) {
    issues.push({
      id: "venue",
      severity: "warn",
      label: "No venue set",
      detail: "Confirmed events should have a venue. Vendors and attendees will ask.",
    })
  }

  if (!form.start_date && !form.date) {
    issues.push({
      id: "start_date",
      severity: "warn",
      label: "No start date set",
      detail: "Without a date, the event won't appear on the upcoming list or countdowns.",
    })
  }

  if (form.start_date && form.end_date) {
    const start = new Date(form.start_date + "T00:00:00").getTime()
    const end = new Date(form.end_date + "T00:00:00").getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      issues.push({
        id: "date_order",
        severity: "warn",
        label: "End date is before start date",
        detail: "The event end date is earlier than the start date — likely a typo.",
      })
    }
  }

  if (!form.budget && !form.estimated_expenses) {
    issues.push({
      id: "budget",
      severity: "info",
      label: "No budget set",
      detail: "Budget tracking won't show on this event's card. Add an estimate to track spend.",
    })
  }

  // Empty client_contacts — soft signal that the event has no point of contact
  const hasContact =
    Array.isArray(form.client_contacts) && form.client_contacts.some((c) => c?.name?.trim())
  if (!hasContact) {
    issues.push({
      id: "contacts",
      severity: "info",
      label: "No client contacts",
      detail: "Add at least one contact so the team knows who to reach.",
    })
  }

  return issues
}

/**
 * Pre-confirm checklist for an event. Surfaces soft warnings when status is
 * `confirmed` or `in-progress` — the "we're committed" gate. Self-hides for
 * `planning` / `completed` / `cancelled`.
 */
export function EventPrePublishChecklist({ formData }: EventPrePublishChecklistProps) {
  const [open, setOpen] = useState(false)
  const issues = useMemo(() => computeIssues(formData), [formData])

  // Only render when the event is locked-in or running. For drafts (planning)
  // we don't want to nag.
  if (formData.status !== "confirmed" && formData.status !== "in-progress") return null

  const isAllClear = issues.length === 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${
          isAllClear
            ? "ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "ring-1 ring-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isAllClear ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5" />
            {issues.length} {issues.length === 1 ? "warning" : "warnings"}
          </>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-full mt-1 z-30 w-80 rounded-md ring-1 ring-neutral-200 bg-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] overflow-hidden"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2.5 border-b border-neutral-100">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Pre-confirm checklist
            </p>
          </div>
          {isAllClear ? (
            <div className="px-3 py-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-900">All checks passed</p>
              <p className="text-xs text-neutral-500 mt-0.5">Nothing to flag.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {issues.map((issue) => (
                <li key={issue.id} className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                        issue.severity === "warn" ? "bg-amber-500" : "bg-neutral-400"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{issue.label}</p>
                      <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                        {issue.detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50">
            <p className="text-[10px] text-neutral-500">
              These are warnings, not errors — you can still save.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

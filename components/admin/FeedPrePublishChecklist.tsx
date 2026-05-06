"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react"

interface MinimalFeedItem {
  id?: string
  slug: string
  status: string
}

interface FeedFormSnapshot {
  title: string
  type: "video" | "article" | "podcast" | "newsletter"
  status: "draft" | "published" | "archived"
  slug: string
  summary: string
  og_image?: string
  hero_image_desktop?: string
  hero_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string
}

interface ChecklistIssue {
  id: string
  severity: "warn" | "info"
  label: string
  detail: string
}

interface FeedPrePublishChecklistProps {
  formData: FeedFormSnapshot
  /** Other feed items in the database, used for slug-collision check. */
  feedItems: MinimalFeedItem[]
  /** Current edit-target id; excluded from collision check. */
  editingId: string | null
}

function computeIssues(form: FeedFormSnapshot, feedItems: MinimalFeedItem[], editingId: string | null): ChecklistIssue[] {
  const issues: ChecklistIssue[] = []

  // OG image — recommended for any published item; non-blocking but high-value
  if (!form.og_image?.trim()) {
    issues.push({
      id: "og_image",
      severity: "warn",
      label: "No social share image",
      detail: "Posts without an OG image render as plain text on Slack, LinkedIn, and X.",
    })
  }

  // Slug collision — only flag against published items with a different id
  const normalizedSlug = form.slug.trim().toLowerCase()
  if (normalizedSlug) {
    const collision = feedItems.find(
      (f) => f.slug?.trim().toLowerCase() === normalizedSlug && f.id !== editingId,
    )
    if (collision) {
      issues.push({
        id: "slug_collision",
        severity: "warn",
        label: "Slug collision",
        detail: `Another feed item already uses /${normalizedSlug}. Publishing will conflict on routing.`,
      })
    }
  }

  // CTA pairs — text without link or link without text on event + spotlights
  const ctaPairs: Array<{ key: string; text?: string; link?: string; section: string }> = [
    {
      key: "event",
      text: form.upcoming_event_cta_text,
      link: form.upcoming_event_cta_link,
      section: "Upcoming event",
    },
    {
      key: "s1",
      text: form.spotlight_1_cta_text,
      link: form.spotlight_1_cta_link,
      section: "Spotlight 1",
    },
    {
      key: "s2",
      text: form.spotlight_2_cta_text,
      link: form.spotlight_2_cta_link,
      section: "Spotlight 2",
    },
    {
      key: "s3",
      text: form.spotlight_3_cta_text,
      link: form.spotlight_3_cta_link,
      section: "Spotlight 3",
    },
  ]

  for (const cta of ctaPairs) {
    const hasText = !!cta.text?.trim()
    const hasLink = !!cta.link?.trim()
    if (hasText !== hasLink) {
      issues.push({
        id: `cta_${cta.key}`,
        severity: "warn",
        label: `${cta.section}: incomplete CTA`,
        detail: hasText
          ? "Button text set but no link — button will render dead."
          : "Button link set but no text — button won't render.",
      })
    }
  }

  // Hero image pair — one set without the other (newsletter only)
  if (form.type === "newsletter") {
    const hasDesktop = !!form.hero_image_desktop?.trim()
    const hasMobile = !!form.hero_image_mobile?.trim()
    if (hasDesktop !== hasMobile) {
      issues.push({
        id: "hero_pair",
        severity: "info",
        label: hasDesktop ? "No mobile hero" : "No desktop hero",
        detail: hasDesktop
          ? "Mobile readers will see the desktop hero scaled down."
          : "Desktop readers will see the mobile hero scaled up.",
      })
    }
  }

  return issues
}

export function FeedPrePublishChecklist({
  formData,
  feedItems,
  editingId,
}: FeedPrePublishChecklistProps) {
  const [open, setOpen] = useState(false)
  const issues = useMemo(
    () => computeIssues(formData, feedItems, editingId),
    [formData, feedItems, editingId],
  )

  // Only render when status is set to published — that's when these checks matter.
  // For drafts we don't want to nag.
  if (formData.status !== "published") return null

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
            Ready to publish
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
              Pre-publish checklist
            </p>
          </div>

          {isAllClear ? (
            <div className="px-3 py-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-900">All checks passed</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Nothing to flag. Safe to publish.
              </p>
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
              These are warnings, not errors — you can still publish.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react"

interface MinimalBlogPost {
  id: string
  slug: string
  title: string
  status: string
}

interface BlogFormSnapshot {
  title: string
  slug: string
  status: "draft" | "published"
  excerpt?: string
  featured_image?: string
  meta_description?: string
  category: string
}

interface ChecklistIssue {
  id: string
  severity: "warn" | "info"
  label: string
  detail: string
}

interface BlogPrePublishChecklistProps {
  formData: BlogFormSnapshot
  posts: MinimalBlogPost[]
  /** ID of the post being edited; excluded from collision check. */
  editingId: string | null
}

function computeIssues(
  form: BlogFormSnapshot,
  posts: MinimalBlogPost[],
  editingId: string | null,
): ChecklistIssue[] {
  const issues: ChecklistIssue[] = []

  // Featured image — published posts without one render as plain text on
  // social shares and in the public listing. Non-blocking but high-value.
  if (!form.featured_image?.trim()) {
    issues.push({
      id: "featured_image",
      severity: "warn",
      label: "No featured image",
      detail: "Posts without a featured image render as plain text on Slack, LinkedIn, and X.",
    })
  }

  // Meta description — Google synthesizes one if missing, but a hand-written
  // description usually outperforms the auto-summary.
  if (!form.meta_description?.trim()) {
    issues.push({
      id: "meta_description",
      severity: "info",
      label: "No SEO description",
      detail:
        "Google will auto-generate one from the post body. A hand-written meta description usually performs better.",
    })
  }

  // Excerpt — used by previews on the blog listing and feed cards.
  if (!form.excerpt?.trim()) {
    issues.push({
      id: "excerpt",
      severity: "info",
      label: "No excerpt",
      detail: "Listings will fall back to the first 100 characters of the post body.",
    })
  }

  // Slug collision
  const normalizedSlug = form.slug.trim().toLowerCase()
  if (normalizedSlug) {
    const collision = posts.find(
      (p) => p.slug?.trim().toLowerCase() === normalizedSlug && p.id !== editingId,
    )
    if (collision) {
      issues.push({
        id: "slug_collision",
        severity: "warn",
        label: "Slug collision",
        detail: `Another post already uses /${normalizedSlug}. Publishing will conflict on routing.`,
      })
    }
  }

  // Default category — easy to forget to change
  if (form.category === "Technology" && !editingId) {
    issues.push({
      id: "default_category",
      severity: "info",
      label: 'Category is "Technology" (default)',
      detail: "Pick a more specific category if it doesn't match.",
    })
  }

  return issues
}

export function BlogPrePublishChecklist({
  formData,
  posts,
  editingId,
}: BlogPrePublishChecklistProps) {
  const [open, setOpen] = useState(false)
  const issues = useMemo(
    () => computeIssues(formData, posts, editingId),
    [formData, posts, editingId],
  )

  // Only render when status is set to published — that's when these matter.
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
              <p className="text-xs text-neutral-500 mt-0.5">Nothing to flag. Safe to publish.</p>
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

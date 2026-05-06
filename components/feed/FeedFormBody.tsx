"use client"

import React, { useCallback, useMemo } from "react"
import {
  Calendar,
  CheckCircle2,
  Cloud,
  Edit,
  Eye,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Save,
  Send,
  Star,
  Tag,
  Users,
  Wand2,
  X,
} from "lucide-react"
import { Badge } from "@/components/analytics/Badge"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { CollapsibleSection, PreviewField } from "./feed-form-primitives"
import { SpotlightFields } from "./SpotlightFields"
import { TaxonomyChipInput } from "./TaxonomyChipInput"
import { FeedPrePublishChecklist } from "@/components/admin/FeedPrePublishChecklist"
import { MOD_KEY_LABEL } from "@/components/admin/useFeedFormShortcuts"
import type { FeedFormData, FeedItem, FeedStatus } from "./feed-types"

interface FeedFormBodyProps {
  // Form state
  formData: FeedFormData
  setFormData: React.Dispatch<React.SetStateAction<FeedFormData>>
  feedItems: FeedItem[]
  editingId: string | null
  isSubmitting: boolean

  // UI state
  previewMode: boolean
  openSections: Set<string>
  setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>

  // Localstorage draft (cross-tab; owned by parent so list view can clear it)
  hasDraft: boolean
  loadDraft: () => void
  clearDraft: () => void
  loadMockData: () => void

  // Auto-save state (parent owns; reads loadFeedItems for refresh)
  isAutoSaving: boolean
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  autoSaveToFirestore: () => void

  // Actions
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void

  // Layout — drawer hides the sticky-header sticky positioning (drawer scrolls
  // its own container) and the bottom action bar (drawer has its own footer).
  variant?: "page" | "drawer"
}

export function FeedFormBody({
  formData,
  setFormData,
  feedItems,
  editingId,
  isSubmitting,
  previewMode,
  openSections,
  setOpenSections,
  hasDraft,
  loadDraft,
  clearDraft,
  loadMockData,
  isAutoSaving,
  lastSavedAt,
  hasUnsavedChanges,
  autoSaveToFirestore,
  onSubmit,
  onCancel,
  variant = "page",
}: FeedFormBodyProps) {
  const inDrawer = variant === "drawer"
  // Image-pair grids stack vertically inside the drawer (xl width is still
  // tight for two large image previews side-by-side). Page mode keeps the
  // 2-column layout so editors can compare desktop + mobile heroes at once.
  const imagePairGrid = inDrawer ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-5"

  // Taxonomy — deduped author + topic strings across all feed items. Powers
  // the autocomplete suggestions in TaxonomyChipInput so editors don't recreate
  // "DC Team" / "Digital Canvas Team" / "DigitalCanvas Team" data drift.
  const authorSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const f of feedItems) for (const a of f.authors ?? []) if (a) set.add(a)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [feedItems])
  const topicSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const f of feedItems) for (const t of f.topics ?? []) if (t) set.add(t)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [feedItems])

  // Slug collision check — finds an existing feed item with the same slug
  // (excluding the one being edited). Used for inline feedback under the slug
  // input. Recomputed on every render; cheap for the small list size 434
  // operates with.
  const slugCollision = (() => {
    const slug = formData.slug.trim().toLowerCase()
    if (!slug) return null
    const match = feedItems.find(
      (f) => f.slug?.trim().toLowerCase() === slug && f.id !== editingId,
    )
    return match ?? null
  })()

  const handleInputChange = useCallback(
    (field: keyof FeedFormData, value: string) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value }
        // Auto-generate slug when title changes (only if slug is empty)
        if (field === "title" && !prev.slug) {
          next.slug = value
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim()
        }
        return next
      })
    },
    [setFormData],
  )

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const expandAllSections = () => {
    setOpenSections(
      new Set(["basic", "metadata", "hero", "sections", "event", "spotlight1", "spotlight2", "spotlight3"]),
    )
  }
  const collapseAllSections = () => setOpenSections(new Set())

  // Jump to a section: open it (so contents are visible) and scroll its anchor
  // into view. The CollapsibleSection wrapper sets scroll-mt-32 to clear the
  // sticky form header in page mode.
  const jumpToSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.add(sectionId)
      return next
    })
    requestAnimationFrame(() => {
      const el = document.getElementById(`feed-section-${sectionId}`)
      el?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  // Section list metadata for the nav. Spotlights collapse to a single chip
  // each so the row stays scannable.
  const navSections: Array<{ id: string; label: string }> = [
    { id: "basic", label: "Basic" },
    { id: "metadata", label: "Metadata" },
    ...(formData.type === "newsletter"
      ? [
          { id: "hero", label: "Hero" },
          { id: "sections", label: "Sections" },
          { id: "event", label: "Event" },
          { id: "spotlight1", label: "Spotlight 1" },
          { id: "spotlight2", label: "Spotlight 2" },
          { id: "spotlight3", label: "Spotlight 3" },
        ]
      : []),
  ]

  const isSectionComplete = (sectionId: string): boolean => {
    switch (sectionId) {
      case "basic":
        return !!(formData.title && formData.summary)
      case "metadata":
        return !!(formData.authors.length > 0 || formData.topics.length > 0)
      case "hero":
        return !!(formData.hero_image_desktop || formData.founders_note_text)
      case "sections":
        return !!(formData.featured_post_title || formData.last_month_gif)
      case "event":
        return !!formData.upcoming_event_title
      case "spotlight1":
        return !!formData.spotlight_1_title
      case "spotlight2":
        return !!formData.spotlight_2_title
      case "spotlight3":
        return !!formData.spotlight_3_title
      default:
        return false
    }
  }

  const getCompletionPercentage = (): number => {
    const sections = ["basic", "metadata", "hero", "sections", "event", "spotlight1", "spotlight2", "spotlight3"]
    const completedCount = sections.filter((s) => isSectionComplete(s)).length
    return Math.round((completedCount / sections.length) * 100)
  }

  return (
    <div className="relative">
      {/* Sticky header — only sticky in page variant; drawer has its own header */}
      <div
        className={
          inDrawer
            ? "px-4 sm:px-6 py-3 bg-white border-b border-neutral-200 mb-5"
            : "sticky top-16 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-neutral-200 mb-5"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Status & info */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  formData.status === "published"
                    ? "bg-emerald-500"
                    : formData.status === "scheduled"
                    ? "bg-blue-500"
                    : formData.status === "draft"
                    ? "bg-amber-500"
                    : "bg-neutral-400"
                }`}
                aria-hidden="true"
              />
              <select
                value={formData.status}
                onChange={(e) => {
                  const next = e.target.value as FeedStatus
                  if (next === "scheduled" && !formData.scheduled_at) {
                    const base = formData.published_date || new Date().toISOString().split("T")[0]
                    const defaultIso = `${base}T09:00`
                    setFormData((prev) => ({ ...prev, status: next, scheduled_at: defaultIso }))
                  } else {
                    handleInputChange("status", next)
                  }
                }}
                className="h-8 px-2 text-xs font-medium rounded-md ring-1 ring-neutral-200 bg-white text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                aria-label="Status"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>

              {formData.status === "scheduled" && (
                <input
                  type="datetime-local"
                  value={formData.scheduled_at || ""}
                  onChange={(e) => handleInputChange("scheduled_at", e.target.value)}
                  className="h-8 px-2 text-xs rounded-md ring-1 ring-neutral-200 bg-white text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none tabular-nums"
                  aria-label="Scheduled publish time"
                />
              )}
            </div>

            {/* Completion bar (newsletter only) */}
            {formData.type === "newsletter" && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-1 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      getCompletionPercentage() === 100 ? "bg-emerald-500" : "bg-neutral-900"
                    }`}
                    style={{ width: `${getCompletionPercentage()}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-neutral-500">
                  {getCompletionPercentage()}%
                </span>
              </div>
            )}

            {/* Auto-save indicator */}
            {/* Autosave indicator — visible when we're saving/saved/dirty.
                Fires for new drafts AND any existing-item edit. */}
            {(editingId || formData.status === "draft") && formData.title?.trim() && formData.summary?.trim() && (
              <div className="flex items-center gap-2">
                {isAutoSaving ? (
                  <Badge className="bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] tabular-nums">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-900 animate-pulse mr-1" aria-hidden="true" />
                    <Cloud className="h-3 w-3 mr-1" />
                    Saving
                  </Badge>
                ) : lastSavedAt ? (
                  <Badge className="bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] tabular-nums">
                    <span className="inline-block h-1 w-1 rounded-full bg-emerald-500 mr-1" aria-hidden="true" />
                    Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                ) : hasUnsavedChanges ? (
                  <Badge className="bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px]">
                    <span className="inline-block h-1 w-1 rounded-full bg-amber-500 mr-1" aria-hidden="true" />
                    Unsaved
                  </Badge>
                ) : null}
                {hasUnsavedChanges && !isAutoSaving && (
                  <button
                    type="button"
                    onClick={autoSaveToFirestore}
                    className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 px-2 py-0.5 rounded transition-colors"
                  >
                    Save now
                  </button>
                )}
              </div>
            )}

            {/* Checklist renders inline only in page mode. In drawer mode the
                parent renders it in the drawer footer next to the Update button. */}
            {!inDrawer && (
              <FeedPrePublishChecklist
                formData={formData}
                feedItems={feedItems}
                editingId={editingId}
              />
            )}
          </div>

          {/* Right: actions — only in page variant; drawer has its own footer */}
          {!inDrawer && (
            <div className="flex items-center gap-2">
              {editingId && (
                <a
                  href={`/admin/feed-form/preview/${editingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  title={`Preview (${MOD_KEY_LABEL}P)`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Cancel (Esc)"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                title={`Save (${MOD_KEY_LABEL}S)`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {editingId ? "Updating…" : "Saving…"}
                  </>
                ) : editingId ? (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Update
                  </>
                ) : formData.status === "published" ? (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Publish
                  </>
                ) : formData.status === "scheduled" ? (
                  <>
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Draft notification — local-storage draft for new items only */}
      {hasDraft && !editingId && (
        <div className="mb-4 mx-4 sm:mx-0 p-3 bg-white rounded-md ring-1 ring-neutral-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                Draft available
              </p>
              <p className="text-sm text-neutral-700 mt-0.5">
                You have an unfinished feed item saved locally.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDraft}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
            >
              Load draft
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-colors"
              aria-label="Clear draft"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Newsletter section toggles — intro card + expand/collapse all */}
      {formData.type === "newsletter" && (
        <div className="mb-5 px-4 sm:px-0">
          {!editingId && !formData.title && (
            <div className="mb-3 p-4 bg-white rounded-md ring-1 ring-neutral-200/70">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-900" aria-hidden="true" />
                New newsletter
              </p>
              <p className="text-sm text-neutral-700 mb-3">
                Click any section header below to expand and edit it. Required fields are marked with{" "}
                <span className="text-red-500">*</span>.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                  <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
                  Complete
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                  <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                  Collapsed
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                  <kbd className="px-1 rounded bg-white ring-1 ring-neutral-200 font-mono text-[10px]">{MOD_KEY_LABEL}S</kbd>
                  Save
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                  <kbd className="px-1 rounded bg-white ring-1 ring-neutral-200 font-mono text-[10px]">{MOD_KEY_LABEL}P</kbd>
                  Preview
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {navSections.map((s) => {
                const open = openSections.has(s.id)
                const complete = isSectionComplete(s.id)
                const dot = complete
                  ? "bg-emerald-500"
                  : open
                  ? "bg-neutral-900"
                  : "bg-neutral-300"
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jumpToSection(s.id)}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                      open
                        ? "bg-white ring-1 ring-neutral-300 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                    title={`Jump to ${s.label}${complete ? " · complete" : ""}`}
                  >
                    <span className={`inline-block h-1 w-1 rounded-full ${dot}`} aria-hidden="true" />
                    {s.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={expandAllSections}
                className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 px-2 py-1 rounded transition-colors"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAllSections}
                className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 px-2 py-1 rounded transition-colors"
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className={`space-y-5 ${inDrawer ? "px-4 sm:px-6 pb-6" : ""}`}>
        {/* Basic Information */}
        <CollapsibleSection
          id="basic"
          title="Basic Information"
          description="Title, type, summary, and publishing details"
          icon={<FileText className="h-5 w-5" />}
          isOpen={openSections.has("basic")}
          onToggle={() => toggleSection("basic")}
          isComplete={isSectionComplete("basic")}
          requirement="required"
        >
          <div className="space-y-4">
            <PreviewField label="Title" value={formData.title} isPreview={previewMode && !!editingId} required>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-base bg-white"
                  placeholder="Enter feed item title"
                  required
                />
              </div>
            </PreviewField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PreviewField
                label="Type"
                value={formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
                isPreview={previewMode && !!editingId}
              >
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleInputChange("type", e.target.value)}
                    className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                  >
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="podcast">Podcast</option>
                    <option value="newsletter">Newsletter</option>
                  </select>
                </div>
              </PreviewField>

              <PreviewField
                label="Published Date"
                value={formData.published_date}
                isPreview={previewMode && !!editingId}
              >
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                    Published Date
                  </label>
                  <input
                    type="date"
                    value={formData.published_date}
                    onChange={(e) => handleInputChange("published_date", e.target.value)}
                    className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white tabular-nums"
                  />
                </div>
              </PreviewField>
            </div>

            <PreviewField
              label="Summary"
              value={formData.summary}
              isPreview={previewMode && !!editingId}
              required
              isRichText
            >
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Summary <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  value={formData.summary}
                  onChange={(value: string) => handleInputChange("summary", value)}
                  placeholder="Enter a brief summary (supports Markdown)"
                  minRows={4}
                />
              </div>
            </PreviewField>

            <PreviewField label="Slug" value={formData.slug} isPreview={previewMode && !!editingId}>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 mb-2">
                  <LinkIcon className="h-3.5 w-3.5 text-neutral-400" />
                  Slug
                  <span className="text-[11px] font-normal text-neutral-400">· auto-generated from title</span>
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleInputChange("slug", e.target.value)}
                  className={`w-full h-10 px-3 ring-1 rounded-md focus:ring-2 focus:outline-none font-mono text-sm bg-white ${
                    slugCollision
                      ? "ring-amber-300 focus:ring-amber-500"
                      : "ring-neutral-200 focus:ring-neutral-900"
                  }`}
                  placeholder="auto-generated-from-title"
                />
                {formData.slug.trim() && (
                  <p
                    className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${
                      slugCollision ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-1 w-1 rounded-full ${
                        slugCollision ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      aria-hidden="true"
                    />
                    {slugCollision ? (
                      <>
                        Used by{" "}
                        <span className="font-medium text-neutral-700">
                          "{slugCollision.title || slugCollision.slug}"
                        </span>{" "}
                        — pick a different slug
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Available</span>
                        <span className="text-neutral-400">
                          · digitalcanvas.community/thefeed/{formData.slug}
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </PreviewField>
          </div>
        </CollapsibleSection>

        {/* Metadata + OG */}
        <CollapsibleSection
          id="metadata"
          title="Metadata & Social Sharing"
          description="Authors, topics, and Open Graph settings for social previews"
          icon={<Tag className="h-5 w-5" />}
          isOpen={openSections.has("metadata")}
          onToggle={() => toggleSection("metadata")}
          isComplete={isSectionComplete("metadata")}
          requirement="optional"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 mb-2">
                  <Users className="h-3.5 w-3.5 text-neutral-400" />
                  Authors
                  {authorSuggestions.length > 0 && (
                    <span className="text-[11px] font-normal text-neutral-400 tabular-nums">
                      · {authorSuggestions.length} known
                    </span>
                  )}
                </label>
                <TaxonomyChipInput
                  values={formData.authors}
                  onChange={(next) => setFormData((prev) => ({ ...prev, authors: next }))}
                  suggestions={authorSuggestions}
                  placeholder="Type to search or add"
                  ariaLabel="Authors"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 mb-2">
                  <Tag className="h-3.5 w-3.5 text-neutral-400" />
                  Topics
                  {topicSuggestions.length > 0 && (
                    <span className="text-[11px] font-normal text-neutral-400 tabular-nums">
                      · {topicSuggestions.length} known
                    </span>
                  )}
                </label>
                <TaxonomyChipInput
                  values={formData.topics}
                  onChange={(next) => setFormData((prev) => ({ ...prev, topics: next }))}
                  suggestions={topicSuggestions}
                  placeholder="Type to search or add"
                  ariaLabel="Topics"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Open Graph
              </p>

              <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-5">
                <PreviewField label="OG Title" value={formData.og_title || ""} isPreview={previewMode && !!editingId}>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Social Title
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· falls back to main title</span>
                    </label>
                    <input
                      type="text"
                      value={formData.og_title || ""}
                      onChange={(e) => handleInputChange("og_title", e.target.value)}
                      className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                      placeholder={formData.title || "Enter social title..."}
                    />
                  </div>
                </PreviewField>

                <PreviewField label="OG Description" value={formData.og_description || ""} isPreview={previewMode && !!editingId}>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Social Description
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· max 160 chars recommended</span>
                    </label>
                    <textarea
                      value={formData.og_description || ""}
                      onChange={(e) => handleInputChange("og_description", e.target.value)}
                      className="w-full px-3 py-2 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white resize-y min-h-20"
                      placeholder={formData.summary ? formData.summary.substring(0, 160) : "Enter social description..."}
                      maxLength={200}
                    />
                    <p className="text-[11px] text-neutral-400 mt-1 text-right tabular-nums">
                      {(formData.og_description || "").length}/200
                    </p>
                  </div>
                </PreviewField>

                <div>
                  <ImageUpload
                    value={formData.og_image || ""}
                    onChange={(value) => handleInputChange("og_image", value)}
                    label="Social Share Image · 1200×630"
                    hideUrl
                  />
                </div>

                {(formData.og_image || formData.og_title || formData.title) && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                      Social Preview
                    </p>
                    <div className="bg-white rounded-md ring-1 ring-neutral-200 overflow-hidden max-w-md">
                      {formData.og_image && (
                        <div className="aspect-[1.91/1] bg-neutral-100 overflow-hidden">
                          <img src={formData.og_image} alt="OG Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">digitalcanvas.community</p>
                        <h5 className="text-sm font-semibold text-neutral-900 line-clamp-2 mb-1">
                          {formData.og_title || formData.title || "Your title here"}
                        </h5>
                        <p className="text-xs text-neutral-500 line-clamp-2">
                          {formData.og_description || formData.summary || "Your description will appear here..."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Newsletter-only sections */}
        {formData.type === "newsletter" && (
          <>
            <CollapsibleSection
              id="hero"
              title="Hero & Founder's Note"
              description="Hero images and opening message"
              icon={<Star className="h-5 w-5" />}
              isOpen={openSections.has("hero")}
              onToggle={() => toggleSection("hero")}
              isComplete={isSectionComplete("hero")}
              requirement="optional"
            >
              <div className="space-y-6">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    Hero images
                  </p>
                  <div className={imagePairGrid}>
                    <ImageUpload
                      value={formData.hero_image_desktop || ""}
                      onChange={(value) => handleInputChange("hero_image_desktop", value)}
                      label="Desktop · 1920×1080"
                      hideUrl
                    />
                    <ImageUpload
                      value={formData.hero_image_mobile || ""}
                      onChange={(value) => handleInputChange("hero_image_mobile", value)}
                      label="Mobile · 1080×1350"
                      hideUrl
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-6">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    Founder's note
                  </p>
                  <PreviewField
                    label="Founder's Note Content"
                    value={formData.founders_note_text || ""}
                    isPreview={previewMode && !!editingId}
                    isRichText
                  >
                    <div>
                      <RichTextEditor
                        value={formData.founders_note_text || ""}
                        onChange={(value: string) => handleInputChange("founders_note_text", value)}
                        placeholder="Enter founder's note content (supports Markdown)"
                        minRows={6}
                      />
                    </div>
                  </PreviewField>
                  <div className="mt-4">
                    <ImageUpload
                      value={formData.founders_note_image || ""}
                      onChange={(value) => handleInputChange("founders_note_image", value)}
                      label="Founder's photo or signature"
                      hideUrl
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="sections"
              title="Content Sections"
              description="Last Month, The Drop, and Featured Post"
              icon={<ImageIcon className="h-5 w-5" />}
              isOpen={openSections.has("sections")}
              onToggle={() => toggleSection("sections")}
              isComplete={isSectionComplete("sections")}
              requirement="optional"
            >
              <div className="space-y-6">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    GIF animations
                  </p>
                  <div className={imagePairGrid}>
                    <ImageUpload
                      value={formData.last_month_gif || ""}
                      onChange={(value) => handleInputChange("last_month_gif", value)}
                      label="Last month"
                      hideUrl
                    />
                    <ImageUpload
                      value={formData.the_drop_gif || ""}
                      onChange={(value) => handleInputChange("the_drop_gif", value)}
                      label="The drop"
                      hideUrl
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-6">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    Featured post
                  </p>
                  <div className="space-y-5 bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
                    <PreviewField
                      label="Featured Post Title"
                      value={formData.featured_post_title || ""}
                      isPreview={previewMode && !!editingId}
                    >
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={formData.featured_post_title || ""}
                          onChange={(e) => handleInputChange("featured_post_title", e.target.value)}
                          className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                          placeholder="Enter featured post title"
                        />
                      </div>
                    </PreviewField>
                    <ImageUpload
                      value={formData.featured_post_image || ""}
                      onChange={(value) => handleInputChange("featured_post_image", value)}
                      label="Featured post image"
                      hideUrl
                    />
                    <PreviewField
                      label="Featured Post Content"
                      value={formData.featured_post_content || ""}
                      isPreview={previewMode && !!editingId}
                      isRichText
                    >
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Content
                          <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· supports Markdown</span>
                        </label>
                        <RichTextEditor
                          value={formData.featured_post_content || ""}
                          onChange={(value: string) => handleInputChange("featured_post_content", value)}
                          placeholder="Featured post content (supports Markdown)"
                          minRows={6}
                        />
                      </div>
                    </PreviewField>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              id="event"
              title="Upcoming Event"
              description="Event details and call-to-action"
              icon={<Calendar className="h-5 w-5" />}
              isOpen={openSections.has("event")}
              onToggle={() => toggleSection("event")}
              isComplete={isSectionComplete("event")}
              requirement="optional"
            >
              <div className="space-y-6">
                <PreviewField
                  label="Event Title"
                  value={formData.upcoming_event_title || ""}
                  isPreview={previewMode && !!editingId}
                >
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Event Title</label>
                    <input
                      type="text"
                      value={formData.upcoming_event_title || ""}
                      onChange={(e) => handleInputChange("upcoming_event_title", e.target.value)}
                      className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                      placeholder="Enter event title"
                    />
                  </div>
                </PreviewField>

                <PreviewField
                  label="Event Description"
                  value={formData.upcoming_event_description || ""}
                  isPreview={previewMode && !!editingId}
                  isRichText
                >
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Event Description
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· supports Markdown</span>
                    </label>
                    <RichTextEditor
                      value={formData.upcoming_event_description || ""}
                      onChange={(value: string) => handleInputChange("upcoming_event_description", value)}
                      placeholder="Event description (supports Markdown)"
                      minRows={6}
                    />
                  </div>
                </PreviewField>

                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    Event images
                  </p>
                  <div className={imagePairGrid}>
                    <ImageUpload
                      value={formData.upcoming_event_image_desktop || ""}
                      onChange={(value) => handleInputChange("upcoming_event_image_desktop", value)}
                      label="Desktop · 1920×1080"
                      hideUrl
                    />
                    <ImageUpload
                      value={formData.upcoming_event_image_mobile || ""}
                      onChange={(value) => handleInputChange("upcoming_event_image_mobile", value)}
                      label="Mobile · 1080×1350"
                      hideUrl
                    />
                  </div>
                </div>

                <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                    Call-to-action
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <PreviewField
                      label="Button Text"
                      value={formData.upcoming_event_cta_text || ""}
                      isPreview={previewMode && !!editingId}
                    >
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Button Text</label>
                        <input
                          type="text"
                          value={formData.upcoming_event_cta_text || ""}
                          onChange={(e) => handleInputChange("upcoming_event_cta_text", e.target.value)}
                          className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                          placeholder="Register Now"
                        />
                      </div>
                    </PreviewField>
                    <PreviewField
                      label="Button Link"
                      value={formData.upcoming_event_cta_link || ""}
                      isPreview={previewMode && !!editingId}
                    >
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Button Link</label>
                        <input
                          type="url"
                          value={formData.upcoming_event_cta_link || ""}
                          onChange={(e) => handleInputChange("upcoming_event_cta_link", e.target.value)}
                          className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none font-mono text-sm bg-white"
                          placeholder="https://example.com/register"
                        />
                      </div>
                    </PreviewField>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {([1, 2, 3] as const).map((num) => (
              <CollapsibleSection
                key={num}
                id={`spotlight${num}`}
                title={`Spotlight ${num}`}
                description={`Highlight section ${num} with image and call-to-action`}
                icon={<Wand2 className="h-5 w-5" />}
                isOpen={openSections.has(`spotlight${num}`)}
                onToggle={() => toggleSection(`spotlight${num}`)}
                isComplete={isSectionComplete(`spotlight${num}`)}
                requirement="optional"
              >
                <SpotlightFields
                  num={num}
                  formData={formData}
                  onFieldChange={(field, value) => handleInputChange(field as keyof FeedFormData, value)}
                  previewMode={previewMode}
                  editingId={editingId}
                />
              </CollapsibleSection>
            ))}
          </>
        )}

        {/* Bottom action bar — only in page variant; drawer has its own footer */}
        {!inDrawer && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-6 border-t border-neutral-200">
            <div className="flex flex-wrap gap-2">
              {!editingId && (
                <button
                  type="button"
                  onClick={loadMockData}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Load Test Data
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

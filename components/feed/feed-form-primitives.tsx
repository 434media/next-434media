"use client"

import React, { useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Marked } from "marked"
import { CheckCircle2, ChevronDown, ChevronRight, Pencil } from "lucide-react"

// Shared marked config — keep in lockstep with production rendering
const previewMarked = new Marked({ async: false, gfm: true, breaks: true })

// =====================================================================
// CollapsibleSection — outermost section wrapper for the feed form. Caller
// owns isOpen/onToggle so the parent can drive expand-all/collapse-all and
// auto-open-on-fresh defaults.
// =====================================================================
interface CollapsibleSectionProps {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  isComplete?: boolean
  /** "Required" or "Optional" pill on the title row. Helps editors triage
   *  must-fill vs polish in long forms. */
  requirement?: "required" | "optional"
  children: React.ReactNode
}

export function CollapsibleSection({
  id,
  title,
  description,
  icon,
  isOpen,
  onToggle,
  isComplete = false,
  requirement,
  children,
}: CollapsibleSectionProps) {
  return (
    <div
      id={`feed-section-${id}`}
      className={`bg-white rounded-md ring-1 overflow-hidden transition-colors scroll-mt-32 ${
        isOpen ? "ring-neutral-900/40" : "ring-neutral-200/70 hover:ring-neutral-300"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
              {requirement === "required" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-[0.16em] bg-neutral-900 text-white">
                  Required
                </span>
              )}
              {requirement === "optional" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-[0.16em] bg-neutral-100 text-neutral-500">
                  Optional
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && !isOpen && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] font-medium uppercase tracking-[0.16em]">
              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
              Complete
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="px-4 pb-5 pt-3 border-t border-neutral-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// =====================================================================
// PreviewField — wraps an editable input. When in preview mode, renders
// the rich-text/plain value with a hover affordance to switch back to
// editing for that single field. Used for in-place edit on existing items.
// =====================================================================
interface PreviewFieldProps {
  label: string
  value: string
  isPreview: boolean
  required?: boolean
  children: React.ReactNode
  isRichText?: boolean
}

export function PreviewField({
  label,
  value,
  isPreview,
  required,
  children,
  isRichText,
}: PreviewFieldProps) {
  const [isEditing, setIsEditing] = useState(false)

  const renderedHtml = useMemo(() => {
    if (!value || !isRichText) return null
    try {
      return previewMarked.parse(value) as string
    } catch {
      return value.replace(/\n/g, "<br />")
    }
  }, [value, isRichText])

  if (!isPreview || isEditing) {
    return (
      <div className="relative">
        {isPreview && isEditing && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 px-3 py-1.5 bg-white hover:bg-neutral-50 rounded-md ring-1 ring-neutral-200 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </button>
          </div>
        )}
        {children}
      </div>
    )
  }

  const renderValue = () => {
    if (!value) {
      return <span className="text-neutral-400 italic text-sm">Click to add content</span>
    }
    if (isRichText && renderedHtml) {
      return (
        <div
          className="prose prose-sm max-w-none text-neutral-700 leading-relaxed
            prose-headings:text-gray-900 prose-strong:text-gray-900
            prose-a:text-blue-600 prose-a:underline
            prose-code:bg-gray-100 prose-code:rounded prose-code:px-1
            prose-blockquote:border-gray-300 prose-blockquote:text-gray-600
            prose-ul:my-2 prose-ol:my-2 prose-li:my-0"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )
    }
    return <span className="text-neutral-800 font-medium">{value}</span>
  }

  return (
    <div className="group cursor-pointer" onClick={() => setIsEditing(true)}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-neutral-600 group-hover:text-neutral-900 transition-colors">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 group-hover:text-neutral-700 px-2 py-0.5 rounded transition-all opacity-50 group-hover:opacity-100 group-focus-within:opacity-100">
          <Pencil className="h-3 w-3" />
          <span className="hidden sm:group-hover:inline">Click to edit</span>
        </span>
      </div>
      <div className="px-4 py-3 bg-neutral-50 rounded-md ring-1 ring-neutral-200 group-hover:ring-neutral-300 transition-colors flex items-center min-h-12">
        {renderValue()}
      </div>
    </div>
  )
}

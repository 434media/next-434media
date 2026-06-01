"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

// Shared dismissible "How it works" first-run intro. A short numbered strip that
// orients a first-time admin to a page (and, for the pipeline pages, where the
// page sits in the funnel). Dismissal is remembered per browser via a
// caller-supplied storageKey, so each page tracks its own dismissed state.
//
// Replaces the two hand-rolled copies that lived in the AI Studio page and the
// SocialCalendarView — keep new intros going through this component.

export interface HowItWorksStep {
  /** Short title, e.g. "Pick a model". */
  title: string
  /** One-line explanation. */
  detail: string
}

interface HowItWorksProps {
  /** Unique localStorage key, e.g. "aiStudioIntroDismissed". */
  storageKey: string
  /** 2–4 steps; rendered as a numbered grid. */
  steps: HowItWorksStep[]
  className?: string
}

export function HowItWorks({ storageKey, steps, className = "" }: HowItWorksProps) {
  // Default hidden until we confirm it hasn't been dismissed — avoids a flash of
  // the strip on every load for users who already dismissed it.
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "1") setShow(true)
    } catch {
      setShow(true)
    }
  }, [storageKey])

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(storageKey, "1")
    } catch {
      /* ignore */
    }
  }

  if (!show) return null

  // Grid columns track step count so 2/3/4 steps all stay balanced.
  const cols = steps.length >= 4 ? "sm:grid-cols-4" : steps.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"

  return (
    <div className={`relative rounded-xl border border-neutral-200 bg-white px-4 py-3 pr-9 ${className}`}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 grid place-items-center h-6 w-6 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className={`grid ${cols} gap-3`}>
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-start gap-2.5">
            <span className="grid place-items-center h-5 w-5 shrink-0 rounded-full bg-neutral-900 text-white text-[11px] font-medium">
              {i + 1}
            </span>
            <div>
              <p className="text-[13px] font-medium text-neutral-900 leading-tight">{s.title}</p>
              <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

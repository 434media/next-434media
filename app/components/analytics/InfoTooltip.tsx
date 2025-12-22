"use client"

import { useState } from "react"

interface InfoTooltipProps {
  content: string
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white/80 transition-colors"
        aria-label="More information"
      >
        i
      </button>
      {isVisible && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-[100] w-56 sm:w-64 p-2.5 sm:p-3 text-[11px] sm:text-xs leading-relaxed text-white/80 bg-neutral-900 border border-white/20 rounded-lg shadow-2xl">
          {content}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-neutral-900 border-l border-t border-white/20 rotate-45" />
        </div>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"

interface InfoTooltipProps {
  content: string
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="ml-2 inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white/80 transition-colors"
        aria-label="More information"
      >
        i
      </button>
      {isVisible && (
        <div className="absolute left-6 top-0 z-50 w-64 p-3 text-xs leading-relaxed text-white/80 bg-black border border-white/20 rounded-lg shadow-xl">
          {content}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-black border-l border-t border-white/20 rotate-45" />
        </div>
      )}
    </div>
  )
}

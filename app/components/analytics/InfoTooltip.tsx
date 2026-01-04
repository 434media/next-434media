"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

interface InfoTooltipProps {
  content: string
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isVisible && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const tooltipWidth = 256 // w-64 = 16rem = 256px
      const tooltipHeight = 100 // approximate height
      
      // Position below the button by default
      let top = rect.bottom + 8
      let left = rect.left + rect.width / 2 - tooltipWidth / 2
      
      // Adjust if tooltip would go off screen right
      if (left + tooltipWidth > window.innerWidth - 16) {
        left = window.innerWidth - tooltipWidth - 16
      }
      
      // Adjust if tooltip would go off screen left
      if (left < 16) {
        left = 16
      }
      
      // If tooltip would go below viewport, show above instead
      if (top + tooltipHeight > window.innerHeight - 16) {
        top = rect.top - tooltipHeight - 8
      }
      
      setPosition({ top, left })
    }
  }, [isVisible])

  const handleMouseEnter = () => setIsVisible(true)
  const handleMouseLeave = (e: React.MouseEvent) => {
    // Check if we're moving to the tooltip
    const relatedTarget = e.relatedTarget as HTMLElement
    if (tooltipRef.current?.contains(relatedTarget)) {
      return
    }
    setIsVisible(false)
  }

  const handleTooltipMouseLeave = (e: React.MouseEvent) => {
    // Check if we're moving back to the button
    const relatedTarget = e.relatedTarget as HTMLElement
    if (buttonRef.current?.contains(relatedTarget)) {
      return
    }
    setIsVisible(false)
  }

  return (
    <div className="relative inline-flex items-center shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsVisible(!isVisible)}
        className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 hover:text-neutral-800 transition-colors font-semibold touch-manipulation"
        aria-label="More information"
      >
        i
      </button>
      {mounted && isVisible && createPortal(
        <div 
          ref={tooltipRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          className="fixed z-[9999] w-64 p-3 text-xs leading-relaxed text-neutral-700 bg-white border border-neutral-200 rounded-xl shadow-xl pointer-events-auto"
          style={{ top: position.top, left: position.left }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  )
}

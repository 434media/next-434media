"use client"

import { useRef, useEffect, useState } from "react"
import { useAnimationFrame } from "motion/react"

interface MarqueeTextProps {
  text: string
  speed?: number
  className?: string
  onClick?: () => void
}

export const MarqueeText = ({ text, speed = 20, className = "", onClick }: MarqueeTextProps) => {
  const [loopNum, setLoopNum] = useState(2)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const baseX = useRef(0)

  useEffect(() => {
    const updateWidths = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const singleContentWidth = contentRef.current.offsetWidth / loopNum
        setContentWidth(singleContentWidth)
        const repeats = Math.ceil(containerWidth / singleContentWidth) + 1
        setLoopNum(repeats)
      }
    }

    updateWidths()
    window.addEventListener("resize", updateWidths)
    return () => window.removeEventListener("resize", updateWidths)
  }, [text, loopNum])

  useAnimationFrame((_, delta) => {
    const moveBy = (speed * delta) / 1000
    baseX.current -= moveBy

    if (baseX.current <= -contentWidth) {
      baseX.current += contentWidth
    }

    if (contentRef.current) {
      contentRef.current.style.transform = `translateX(${baseX.current}px)`
    }
  })

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${text} - Click to open menu` : undefined}
    >
      <div ref={contentRef} className="inline-block">
        {[...Array(loopNum)].map((_, index) => (
          <span key={index} className="inline-block mr-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-emerald-600">
              {text}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
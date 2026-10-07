"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  duration?: number
  className?: string
  direction?: "up" | "down" | "left" | "right" | "none"
  distance?: number
  once?: boolean
  threshold?: number
}

/**
 * Fades its children in, offset by `distance` px from `direction`, once they
 * are `threshold` in view. The entrance is CSS (.m-fade-in-view, globals.css)
 * with the same duration, delay, distance and easing — [0.25, 0.1, 0.25, 1],
 * which is CSS `ease` — that the motion version used (2b fix 10).
 *
 * It plays once. `once` is kept for callers; the motion version also played
 * only once whatever it was set to, because it never reset after animating.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
  direction = "up",
  distance = 20,
  threshold = 0.1,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const offset = {
    up: { x: "0px", y: `${distance}px` },
    down: { x: "0px", y: `${-distance}px` },
    left: { x: `${distance}px`, y: "0px" },
    right: { x: `${-distance}px`, y: "0px" },
    none: { x: "0px", y: "0px" },
  }[direction]

  return (
    <div
      ref={ref}
      className={`m-fade-in-view ${className}`.trim()}
      data-shown={shown ? "true" : "false"}
      style={
        {
          "--m-x": offset.x,
          "--m-y": offset.y,
          "--m-duration": `${duration}s`,
          "--m-delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

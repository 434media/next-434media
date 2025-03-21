"use client"

import { useEffect, useCallback } from "react"

interface KeyboardNavigationProps {
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onHome?: () => void
  onEnd?: () => void
  onEscape?: () => void
  onEnter?: () => void
  enabled?: boolean
}

export function KeyboardNavigation({
  onArrowLeft,
  onArrowRight,
  onArrowUp,
  onArrowDown,
  onHome,
  onEnd,
  onEscape,
  onEnter,
  enabled = true,
}: KeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      switch (e.key) {
        case "ArrowLeft":
          if (onArrowLeft) {
            e.preventDefault()
            onArrowLeft()
          }
          break
        case "ArrowRight":
          if (onArrowRight) {
            e.preventDefault()
            onArrowRight()
          }
          break
        case "ArrowUp":
          if (onArrowUp) {
            e.preventDefault()
            onArrowUp()
          }
          break
        case "ArrowDown":
          if (onArrowDown) {
            e.preventDefault()
            onArrowDown()
          }
          break
        case "Home":
          if (onHome) {
            e.preventDefault()
            onHome()
          }
          break
        case "End":
          if (onEnd) {
            e.preventDefault()
            onEnd()
          }
          break
        case "Escape":
          if (onEscape) {
            e.preventDefault()
            onEscape()
          }
          break
        case "Enter":
          if (onEnter) {
            e.preventDefault()
            onEnter()
          }
          break
      }
    },
    [enabled, onArrowLeft, onArrowRight, onArrowUp, onArrowDown, onHome, onEnd, onEscape, onEnter],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  return null
}


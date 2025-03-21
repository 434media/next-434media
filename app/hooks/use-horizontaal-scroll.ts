"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import { useMotionValue, useScroll } from "motion/react"

export function useHorizontalScroll() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollX = useMotionValue(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const { scrollXProgress } = useScroll({ container: scrollRef })

  // Update scrollX value when scrollXProgress changes
  useEffect(() => {
    const unsubscribe = scrollXProgress.on("change", (latest) => {
      scrollX.set(latest)
      setCanScrollLeft(latest > 0.01)
      setCanScrollRight(latest < 0.99)
    })

    return () => unsubscribe()
  }, [scrollXProgress, scrollX])

  // Scroll left or right by container width
  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current
    if (container) {
      const scrollAmount = direction === "left" ? -container.offsetWidth : container.offsetWidth
      container.scrollBy({ left: scrollAmount, behavior: "smooth" })
    }
  }, [])

  // Scroll to a specific item
  const scrollToItem = useCallback((itemIndex: number) => {
    const container = scrollRef.current
    const items = container?.children

    if (container && items && items[itemIndex]) {
      const item = items[itemIndex] as HTMLElement
      const leftOffset = item.offsetLeft - container.offsetLeft

      container.scrollTo({
        left: leftOffset,
        behavior: "smooth",
      })
    }
  }, [])

  return {
    scrollRef,
    scrollX,
    scrollXProgress,
    canScrollLeft,
    canScrollRight,
    scroll,
    scrollToItem,
  }
}


"use client"

import { useEffect } from "react"

export function ClientScrollToTop() {
  useEffect(() => {
    // Scroll to top on page load
    window.scrollTo(0, 0)
  }, [])

  return null
}

"use client"

import { useEffect } from "react"

export default function SDOHClientScript() {
  useEffect(() => {
    // Force toggle visibility with inline styles
    const forceToggleVisibility = () => {
      const toggleContainer = document.getElementById("language-toggle-container")

      if (toggleContainer) {
        Object.assign(toggleContainer.style, {
          position: "fixed",
          top: "80px",
          right: "20px",
          zIndex: "99999",
          visibility: "visible",
          opacity: "1",
          pointerEvents: "auto",
        })

        // Also ensure the toggle itself is visible
        const toggle = toggleContainer.querySelector('[data-testid="sdoh-language-toggle"]')
        if (toggle instanceof HTMLElement) {
          Object.assign(toggle.style, {
            visibility: "visible",
            opacity: "1",
            pointerEvents: "auto",
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            padding: "8px 12px",
          })
        }
      }
    }

    // Run multiple times to ensure it works
    forceToggleVisibility()
    const timer1 = setTimeout(forceToggleVisibility, 500)
    const timer2 = setTimeout(forceToggleVisibility, 1000)

    // Add a MutationObserver to ensure the toggle stays visible
    const observer = new MutationObserver(() => {
      forceToggleVisibility()
    })

    const container = document.getElementById("language-toggle-container")
    if (container) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      })
    }

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      observer.disconnect()
    }
  }, [])

  return null
}

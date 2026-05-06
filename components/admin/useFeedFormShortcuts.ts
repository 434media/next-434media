"use client"

import { useEffect } from "react"

interface FeedFormShortcutHandlers {
  enabled: boolean
  onSave?: () => void
  onPublish?: () => void
  onPreview?: () => void
  onCancel?: () => void
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
const isModKey = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey)

/**
 * Editorial shortcuts for the feed-form page. Only fires when `enabled` is true
 * (typically when the create/edit tab is active). Skips the handler if the
 * user is in a contenteditable region or modal so shortcuts don't fight with
 * native textarea editing — except for ⌘S, which is intentionally global.
 */
export function useFeedFormShortcuts({ enabled, onSave, onPublish, onPreview, onCancel }: FeedFormShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const inEditable =
        tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable === true

      // ⌘S / Ctrl+S — save (always, even from inside an input)
      if (isModKey(e) && key === "s" && !e.shiftKey) {
        e.preventDefault()
        onSave?.()
        return
      }

      // ⌘↩ / Ctrl+Enter — publish (always)
      if (isModKey(e) && key === "enter") {
        e.preventDefault()
        onPublish?.()
        return
      }

      // ⌘P / Ctrl+P — preview (override print; skip if user is typing in an input)
      if (isModKey(e) && key === "p" && !e.shiftKey) {
        e.preventDefault()
        onPreview?.()
        return
      }

      // Escape — cancel/back; ignore if user is in a textarea/input that may want
      // to clear their selection or close a native dropdown
      if (key === "escape" && !inEditable) {
        onCancel?.()
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [enabled, onSave, onPublish, onPreview, onCancel])
}

/** Display string for the modifier key, sized for help text. */
export const MOD_KEY_LABEL = isMac ? "⌘" : "Ctrl"

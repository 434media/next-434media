"use client"

import { useCallback, useState } from "react"
import type { Toast } from "./types"
import type { LeadSource } from "@/types/crm-types"

export type AudienceCollection =
  | "partner_list_members"
  | "event_registrations"
  | "email_signups"
  | "contact_forms"

export interface PromoteOverrides {
  overrideSource?: LeadSource
  extraTags?: string[]
  noteAddendum?: string
}

interface UsePromoteToLeadsArgs {
  collection: AudienceCollection
  /** Refetch the audience-side rows so the now-promoted ones flip status. */
  onSuccess?: () => Promise<void> | void
  setToast: (t: Toast | null) => void
  /** Drop bulk selection on success — usually `clearSelected` from useSelection. */
  onClearSelection?: () => void
}

interface UsePromoteToLeadsResult {
  promotingIds: Set<string>
  /** True when this id is currently being promoted (shows spinner / disables button). */
  isPromoting: (id: string) => boolean
  /** Promote one or more ids, optionally with source/tags/notes overrides. */
  promote: (ids: string[], overrides?: PromoteOverrides) => Promise<void>
}

/**
 * Shared promote-to-leads behavior. Used by every audience surface tab
 * (Lists, Events, Newsletter, Inbox) so the toast wording, error handling,
 * and refetch lifecycle all match.
 */
export function usePromoteToLeads({
  collection,
  onSuccess,
  setToast,
  onClearSelection,
}: UsePromoteToLeadsArgs): UsePromoteToLeadsResult {
  const [promotingIds, setPromotingIds] = useState<Set<string>>(new Set())

  const isPromoting = useCallback((id: string) => promotingIds.has(id), [promotingIds])

  const promote = useCallback(
    async (ids: string[], overrides?: PromoteOverrides) => {
      if (ids.length === 0) return
      setPromotingIds((prev) => new Set([...prev, ...ids]))
      try {
        const res = await fetch("/api/admin/leads/promote-from-audience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection,
            ids,
            overrideSource: overrides?.overrideSource,
            extraTags: overrides?.extraTags,
            noteAddendum: overrides?.noteAddendum,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
          setToast({ message: data.error || "Failed to promote", type: "error" })
          return
        }
        const { created, linked, alreadyPromoted, failed } = data.summary as {
          created: number
          linked: number
          alreadyPromoted: number
          notFound: number
          failed: number
        }
        const parts: string[] = []
        if (created > 0) parts.push(`${created} created`)
        if (linked > 0) parts.push(`${linked} linked to existing`)
        if (alreadyPromoted > 0) parts.push(`${alreadyPromoted} already promoted`)
        if (failed > 0) parts.push(`${failed} failed`)
        setToast({
          message: `Promote: ${parts.join(", ") || "no changes"}`,
          type: failed > 0 ? "error" : "success",
        })
        if (onSuccess) await onSuccess()
        if (failed === 0 && onClearSelection) onClearSelection()
      } catch (err) {
        console.error("[usePromoteToLeads] failed:", err)
        setToast({ message: "Failed to promote", type: "error" })
      } finally {
        setPromotingIds((prev) => {
          const next = new Set(prev)
          for (const id of ids) next.delete(id)
          return next
        })
      }
    },
    [collection, setToast, onSuccess, onClearSelection],
  )

  return { promotingIds, isPromoting, promote }
}

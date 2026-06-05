"use client"

import { useState, useEffect, useCallback } from "react"
import type { TeamMember } from "@/components/crm/types"

/**
 * Read-only roster of assignable team members — the ACTIVE rows from the
 * Firestore crm_team_members collection, and nothing else. Used by every
 * assignee picker (Task / Opportunity / Client / Lead drawers + filters).
 *
 * The roster is managed entirely by super-admins in CRM Settings → Team members
 * (add / deactivate / delete); this hook does NOT mutate and no longer injects
 * any built-in seed names. The GET endpoint's super-admin backfill guarantees
 * Marcos and Jesse always exist, so the list is never empty even on a fresh
 * environment.
 *
 * Pass `enabled` to defer the fetch until a surface is shown (e.g. a drawer's
 * `open`); it refetches whenever `enabled` transitions to true.
 */
export function useTeamMembers(enabled = true) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/team-members")
      const data = await response.json()

      const firestoreMembers: TeamMember[] =
        data.success && data.data ? data.data.filter((m: TeamMember) => m.isActive) : []
      firestoreMembers.sort((a, b) => a.name.localeCompare(b.name))
      setMembers(firestoreMembers)
    } catch {
      // Transient failure — show an empty roster rather than resurrecting seeds.
      setMembers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { members, isLoading, refetch }
}

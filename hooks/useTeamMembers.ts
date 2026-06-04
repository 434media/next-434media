"use client"

import { useState, useEffect, useCallback } from "react"
import { TEAM_MEMBERS } from "@/components/crm/types"
import type { TeamMember } from "@/components/crm/types"

// Builds the default member records from the built-in TEAM_MEMBERS roster.
function buildDefaultMembers(): TeamMember[] {
  const now = new Date().toISOString()
  return TEAM_MEMBERS.map((m, i) => ({
    id: `default-${i}`,
    name: m.name,
    email: m.email,
    isActive: true,
    created_at: now,
    updated_at: now,
  }))
}

/**
 * Read-only roster of assignable team members — active Firestore members merged
 * with the built-in defaults (so the list is never empty even before anyone is
 * seeded). Used by assignee pickers.
 *
 * Management (add / role / activate / delete) lives in CRM Settings → Team
 * members (super-admin only); this hook intentionally does NOT mutate.
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

      // Active Firestore members, then add any default not already represented
      // (by name or email) so built-in members always appear.
      const firestoreMembers: TeamMember[] =
        data.success && data.data ? data.data.filter((m: TeamMember) => m.isActive) : []

      const firestoreNames = new Set(firestoreMembers.map((m) => m.name.toLowerCase()))
      const firestoreEmails = new Set(
        firestoreMembers.map((m) => m.email?.toLowerCase()).filter(Boolean),
      )
      const missingDefaults = buildDefaultMembers().filter(
        (d) =>
          !firestoreNames.has(d.name.toLowerCase()) &&
          (!d.email || !firestoreEmails.has(d.email.toLowerCase())),
      )

      const allMembers = [...firestoreMembers, ...missingDefaults]
      allMembers.sort((a, b) => a.name.localeCompare(b.name))
      setMembers(allMembers)
    } catch {
      // Fall back to the built-in defaults on any failure.
      setMembers(buildDefaultMembers())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { members, isLoading, refetch }
}

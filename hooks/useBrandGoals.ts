"use client"

import { useState, useEffect, useCallback } from "react"
import { BRAND_GOALS } from "@/components/crm/types"
import type { BrandGoal } from "@/components/crm/types"

/**
 * Effective brand sales goals — the BRAND_GOALS seed (brand / color /
 * description / grouping) merged with any super-admin target overrides stored in
 * Firestore. Used by the Dashboard pacing strip, the Pipeline brand cards, and
 * the Opportunities kanban goal tracker.
 *
 * State defaults to the seed, so the UI renders correct structure instantly and
 * only the numbers shift if a target was overridden — no empty flash, and a
 * graceful fall back to the seed on any fetch failure.
 *
 * Management (editing a target) lives in CRM Settings → Brand goals (super-admin
 * only); this hook is read-only.
 */
export function useBrandGoals(enabled = true) {
  const [goals, setGoals] = useState<BrandGoal[]>(BRAND_GOALS)
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/crm/brand-goals")
      const data = await res.json()
      if (data.success && Array.isArray(data.goals) && data.goals.length > 0) {
        setGoals(data.goals as BrandGoal[])
      } else {
        setGoals(BRAND_GOALS)
      }
    } catch {
      setGoals(BRAND_GOALS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) refetch()
  }, [enabled, refetch])

  return { goals, isLoading, refetch }
}

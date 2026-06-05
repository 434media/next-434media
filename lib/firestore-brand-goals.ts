import { getDb } from "./firebase-admin"
import { BRAND_GOALS, type Brand, type BrandGoal } from "@/components/crm/types"

/**
 * Brand sales goals — the annual revenue targets that drive the Dashboard
 * pacing strip, the Pipeline brand cards, and the Opportunities kanban goal
 * tracker.
 *
 * The STRUCTURE of each goal (brand, color, description, includedBrands) is a
 * deliberate contract and lives in the BRAND_GOALS seed in components/crm/types.
 * Only the TARGET (`annualGoal`) is editable by super-admins — stored here as a
 * per-brand override and merged onto the seed at read time. So changing a target
 * no longer requires a developer + deploy, while the brand grouping stays fixed.
 */

const COLLECTION = "crm_brand_goals"

export interface BrandGoalOverride {
  brand: Brand
  annualGoal: number
  updatedBy: string
  updatedAt: string
}

/** Map of brand → overridden annual target. Brands with no override are absent. */
export async function getBrandGoalOverrides(): Promise<Record<string, number>> {
  const db = getDb()
  const snap = await db.collection(COLLECTION).get()
  const out: Record<string, number> = {}
  snap.forEach((doc) => {
    const d = doc.data()
    const brand = String(d.brand ?? doc.id)
    const target = typeof d.annualGoal === "number" ? d.annualGoal : Number(d.annualGoal)
    if (brand && Number.isFinite(target) && target > 0) out[brand] = target
  })
  return out
}

/** The seed goals with any stored target overrides applied. Same shape as BRAND_GOALS. */
export async function getEffectiveBrandGoals(): Promise<BrandGoal[]> {
  const overrides = await getBrandGoalOverrides()
  return BRAND_GOALS.map((g) => ({ ...g, annualGoal: overrides[g.brand] ?? g.annualGoal }))
}

/** Upsert a single brand's annual target. Validates brand + positive number. */
export async function setBrandGoalTarget(brand: Brand, annualGoal: number, email: string): Promise<void> {
  if (!BRAND_GOALS.some((g) => g.brand === brand)) {
    throw new Error(`Unknown brand: ${brand}`)
  }
  if (!Number.isFinite(annualGoal) || annualGoal <= 0) {
    throw new Error("Target must be a positive number")
  }
  const db = getDb()
  await db.collection(COLLECTION).doc(brand).set(
    { brand, annualGoal, updatedBy: email, updatedAt: new Date().toISOString() },
    { merge: true },
  )
}

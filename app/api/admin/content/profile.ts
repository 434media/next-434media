import { PIPELINE_PROPERTIES } from "@/lib/content-pipeline/properties"
import type { ActiveProfile } from "@/lib/content-pipeline/brand"

/**
 * The brand's published profile for one Create table request, read from the database every time (no cache: plan v11
 * Step 1 item 7). A brand outside the roster, inactive, or without a valid published profile is refused with a reason.
 */
export async function createProfile(brand: string): Promise<{ active: ActiveProfile } | { error: string; status: 400 | 500 }> {
  const property = PIPELINE_PROPERTIES.find(p => p.id === brand)
  if (!property) return { error: "Unknown brand", status: 400 }
  if (!property.active) return { error: `${property.label}: ${property.reason ?? "not available yet"}`, status: 400 }
  try {
    const { readPublishedProfile } = await import("@/lib/firestore-brand-profiles")
    const r = await readPublishedProfile(brand)
    return "active" in r ? r : { error: `${property.label} has no valid published profile`, status: 400 }
  } catch (err) {
    console.error("[content/create] profile not read:", err)
    return { error: "Could not read the brand profile", status: 500 }
  }
}

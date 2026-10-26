import { NextResponse } from "next/server"
import { requireStaff } from "../content-pipeline/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/brands — the Brands area's list (plan v11.2.1 Step 4 item 2): every brand on the roster and every
 * brand with a profile document (client brands too), with its type, status, published profile version, onboarding
 * progress and missing templates, read on this request. Open to 434 staff (interns excluded), who read the brand books;
 * `canEdit` says whether the caller may edit and publish profiles (super-admins).
 */
export async function GET() {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const [{ readAllBrands }, { brandState, missingTemplates, onboardingChecklist }] = await Promise.all([import("@/lib/firestore-brands"), import("@/lib/content-pipeline/brand-status")])
    const brands = (await readAllBrands()).map(({ facts: f }) => {
      const checklist = onboardingChecklist(f)
      return {
        id: f.id, label: f.label, brandType: f.brandType, state: brandState(f), versionId: f.published?.versionId ?? null, publishedAt: f.published?.publishedAt ?? null,
        draftDiffers: f.draftDiffers, problem: f.published ? null : f.publishedProblem, stepsDone: checklist.filter(c => c.status === "done").length, steps: checklist.length,
        missing: missingTemplates(f.published?.profile ?? null, f.label, f.brandBook, f.brandBookProblem).length, postsMade: f.postsMade, hasBook: f.brandBook,
      }
    })
    return NextResponse.json({ brands, canEdit: auth.superAdmin }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brands]", err)
    return NextResponse.json({ error: "Could not read the brands" }, { status: 500 })
  }
}

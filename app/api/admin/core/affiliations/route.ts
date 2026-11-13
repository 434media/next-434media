import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { ensureAffiliation } from "@/lib/core-model/service"
import { canSee } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { CORE_ROLES, type CoreRole } from "@/types/core-model"

export const runtime = "nodejs"

// POST /api/admin/core/affiliations { person_id, organization_id, role, title? } — link a stored Person to a
// stored Organization with a role. The same link twice returns the existing one.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await readJson(request)
  const personId = optString(body?.person_id, 200)
  const organizationId = optString(body?.organization_id, 200)
  const role = body?.role as CoreRole
  if (!personId || !organizationId || !CORE_ROLES.includes(role)) {
    return NextResponse.json({ error: "person_id, organization_id and a known role are required" }, { status: 400 })
  }
  try {
    const viewer = await viewerOf(auth.session)
    const [person, org] = await Promise.all([firestoreCoreStore.getPerson(personId), firestoreCoreStore.getOrganization(organizationId)])
    if (!person || !org || !canSee(person, viewer) || !canSee(org, viewer)) {
      return NextResponse.json({ error: "Both must be stored records you can see" }, { status: 404 })
    }
    const link = await ensureAffiliation(firestoreCoreStore, person.id, org.id, role, optString(body?.title, 200))
    return NextResponse.json({ success: true, data: link }, { status: 201 })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/affiliations", error)
  }
}

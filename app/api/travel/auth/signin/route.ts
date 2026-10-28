import { NextResponse, type NextRequest } from "next/server"
import { verifyFirebaseToken } from "@/lib/firebase-admin"
import { verifiedEmail } from "@/lib/firebase-signin"
import { authorizeTravelViewer, setTravelSession } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/firestore-travel-projects"

export async function POST(request: NextRequest) {
  try {
    const { idToken, projectSlug, travelerSlug } = (await request.json()) as {
      idToken?: string
      projectSlug?: string
      travelerSlug?: string
    }
    if (!idToken || !projectSlug || !travelerSlug || !(await getTravelProject(projectSlug, travelerSlug))) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    }
    // The Firebase tenant is shared, and an account can be created there under any address, so the address counts
    // only once Firebase says it is verified (security log ADM-15, the same class as ADM-1). Revoked tokens are refused.
    const identity = verifiedEmail(await verifyFirebaseToken(idToken, true))
    if (!identity.ok) {
      console.warn(`[travel-auth] denied sign-in (${identity.reason})`)
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }
    const viewer = await authorizeTravelViewer(identity.email, projectSlug, travelerSlug)
    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 403 })
    }
    await setTravelSession(viewer)
    return NextResponse.json({ success: true, viewer: { email: viewer.email, name: viewer.name } })
  } catch (error) {
    console.error("[travel-auth] sign-in failed", error)
    return NextResponse.json({ error: "authentication_failed" }, { status: 401 })
  }
}

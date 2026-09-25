import { NextResponse, type NextRequest } from "next/server"
import { verifyFirebaseToken } from "@/lib/firebase-admin"
import { authorizeTravelViewer, setTravelSession } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/travel/projects"

export async function POST(request: NextRequest) {
  try {
    const { idToken, projectSlug, travelerSlug } = (await request.json()) as {
      idToken?: string
      projectSlug?: string
      travelerSlug?: string
    }
    if (!idToken || !projectSlug || !travelerSlug || !getTravelProject(projectSlug, travelerSlug)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    }
    const identity = await verifyFirebaseToken(idToken)
    if (!identity.email) {
      return NextResponse.json({ error: "email_missing" }, { status: 400 })
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

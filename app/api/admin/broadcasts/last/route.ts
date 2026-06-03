import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb } from "@/lib/firebase-admin"

export const runtime = "nodejs"

// GET /api/admin/broadcasts/last
// Returns the most recent Resend broadcast (from the `broadcasts` log), or null
// if none have been sent. Drives the "Last broadcast" strip on the Audiences
// newsletter tab — the marketing flow is now occasional Resend broadcasts, not
// regular Mailchimp campaigns.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const snap = await getDb().collection("broadcasts").orderBy("sentAt", "desc").limit(1).get()
    const doc = snap.docs[0]
    return NextResponse.json({ ok: true, broadcast: doc ? doc.data() : null })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load last broadcast" },
      { status: 500 },
    )
  }
}

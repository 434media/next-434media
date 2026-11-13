import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, inboxItems } from "@/lib/core-model/read"
import { viewerOf } from "@/lib/core-model/route-helpers"

export const runtime = "nodejs"

// GET /api/admin/core/inbox — the inbox is a view: every activity not yet triaged, from any way in (today the
// website forms, including AIM's; later Google Contacts and Polí's mail), with its Person and its Organization's
// fit and grade. Visibility filtered. The view is cached for 30 s and built once per window.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const view = await getVisibleCoreView(await viewerOf(auth.session))
    const items = inboxItems(view)
    return NextResponse.json({
      success: true,
      data: items,
      counts: { inbox: items.length, people: view.people.length, organizations: view.organizations.length },
      warnings: view.warnings,
      built_at: view.built_at,
    })
  } catch (error) {
    console.error("[GET /api/admin/core/inbox]", error)
    return NextResponse.json({ error: "Failed to load the inbox" }, { status: 500 })
  }
}

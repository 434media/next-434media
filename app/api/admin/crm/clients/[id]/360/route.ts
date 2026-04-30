import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getCustomer360 } from "@/lib/customer-360"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Client id required" }, { status: 400 })
  }

  try {
    const data = await getCustomer360(id)
    if (!data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error(`[Customer360] Failed for client ${id}:`, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

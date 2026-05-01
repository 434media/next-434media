import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { deleteGoal, getGoalById, updateGoal, type GoalUpdateInput } from "@/lib/firestore-goals"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ALLOWED: Array<keyof GoalUpdateInput> = [
    "name",
    "source",
    "eventName",
    "target",
    "period",
    "propertyId",
    "invertGoodness",
  ]
  const patch: GoalUpdateInput = {}
  for (const key of ALLOWED) {
    if (key in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(patch as any)[key] = body[key]
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 })
  }

  try {
    const goal = await updateGoal(id, patch)
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error(`[PATCH /goals/${id}]`, err)
    const status = err instanceof Error && err.message.includes("not found") ? 404 : 500
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update goal" },
      { status },
    )
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params
  try {
    const existing = await getGoalById(id)
    if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    await deleteGoal(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[DELETE /goals/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete goal" },
      { status: 500 },
    )
  }
}

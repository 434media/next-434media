import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin, isCrmSuperAdmin } from "@/lib/auth"
import { getEffectiveBrandGoals, setBrandGoalTarget } from "@/lib/firestore-brand-goals"
import type { Brand } from "@/components/crm/types"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

async function requireSuperAdmin() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const ok = await isCrmSuperAdmin(auth.session.email)
  if (!ok) return { error: "Forbidden: Super admin required", status: 403 as const }
  return auth
}

// GET /api/admin/crm/brand-goals — effective brand goals (seed + target overrides).
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const goals = await getEffectiveBrandGoals()
    return NextResponse.json({ success: true, goals })
  } catch (err) {
    console.error("[GET /brand-goals]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load brand goals" },
      { status: 500 },
    )
  }
}

// PATCH /api/admin/crm/brand-goals — set one brand's annual target (super-admin).
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const brand = typeof body.brand === "string" ? body.brand.trim() : ""
  const annualGoal = typeof body.annualGoal === "number" ? body.annualGoal : Number(body.annualGoal)
  if (!brand) {
    return NextResponse.json({ error: "brand is required" }, { status: 400 })
  }
  if (!Number.isFinite(annualGoal) || annualGoal <= 0) {
    return NextResponse.json({ error: "annualGoal must be a positive number" }, { status: 400 })
  }

  try {
    await setBrandGoalTarget(brand as Brand, annualGoal, auth.session.email)
    const goals = await getEffectiveBrandGoals()
    return NextResponse.json({ success: true, goals })
  } catch (err) {
    console.error("[PATCH /brand-goals]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update brand goal" },
      { status: 500 },
    )
  }
}

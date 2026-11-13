// Shared by the core model's admin routes (app/api/admin/core/**): who is viewing, and the error contract.

import { NextResponse } from "next/server"
import { isCrmSuperAdmin, type User } from "@/lib/auth"
import type { Viewer } from "./read"
import { CoreRuleError, DuplicateError } from "./service"

export async function viewerOf(session: User): Promise<Viewer> {
  return { role: session.role ?? null, superAdmin: await isCrmSuperAdmin(session.email) }
}

/** 400/404/409/502 for a broken rule, 409 with the existing id for a duplicate, 500 for anything else. */
export function coreErrorResponse(label: string, err: unknown) {
  if (err instanceof DuplicateError) {
    return NextResponse.json({ error: err.message, existing_id: err.existingId }, { status: 409 })
  }
  if (err instanceof CoreRuleError) {
    if (err.status === 502) console.error(`[${label}]`, err.message)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(`[${label}]`, err)
  return NextResponse.json({ error: "Failed to save" }, { status: 500 })
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const optString = (v: unknown, max = 500): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined

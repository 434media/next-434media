import { NextRequest, NextResponse } from "next/server"
import { getLead, updateLead } from "@/app/lib/lead-db"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const lead = await getLead(params.id)
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ lead })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const updates = await req.json()
  const lead = await updateLead(params.id, updates)
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ lead })
}

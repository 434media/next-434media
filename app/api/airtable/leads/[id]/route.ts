import { NextRequest, NextResponse } from "next/server"
import { pushLeadToAirtable, airtableConfigStatus } from "@/app/lib/airtable"
import { initLeadTable } from "@/app/lib/lead-db"

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await initLeadTable().catch(()=>{})
    const cfg = airtableConfigStatus()
    if (!cfg.configured) {
      return NextResponse.json({ error: 'Airtable not configured', missing: cfg.missing }, { status: 500 })
    }
    const result = await pushLeadToAirtable(params.id)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Export failed' }, { status: 500 })
  }
}

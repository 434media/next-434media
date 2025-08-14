import { NextRequest, NextResponse } from "next/server"
import { pushManyLeadsToAirtable, airtableConfigStatus } from "@/app/lib/airtable"
import { initLeadTable } from "@/app/lib/lead-db"
import { pool } from "@/app/lib/db"

export const runtime = 'nodejs'

async function fetchLeadIds(limit = 50, status = 'new'): Promise<string[]> {
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT id FROM leads WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT $2', [status, limit])
    return res.rows.map(r => r.id.toString())
  } finally { client.release() }
}

export async function POST(req: NextRequest) {
  try {
    await initLeadTable().catch(()=>{})
    const cfg = airtableConfigStatus()
    if (!cfg.configured) {
      return NextResponse.json({ error: 'Airtable not configured', missing: cfg.missing }, { status: 500 })
    }
    const body = await req.json().catch(()=>({}))
    const { ids, limit, status } = body
    let targetIds: string[]
    if (Array.isArray(ids) && ids.length) targetIds = ids
    else targetIds = await fetchLeadIds(limit || 25, status || 'new')
    const results = await pushManyLeadsToAirtable(targetIds)
    return NextResponse.json({ ok: true, count: results.length, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bulk export failed' }, { status: 500 })
  }
}

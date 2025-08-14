import { pool } from "./db"
import type { Lead } from "../types/lead-types"

const API_KEY = process.env.AIRTABLE_API_KEY
const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Leads"

interface AirtableRecord<T> { id: string; fields: T }

function envOk() {
  return !!(API_KEY && BASE_ID && TABLE_NAME)
}

export function airtableConfigStatus() {
  return {
    configured: envOk(),
    missing: [!API_KEY && "AIRTABLE_API_KEY", !BASE_ID && "AIRTABLE_BASE_ID", !TABLE_NAME && "AIRTABLE_TABLE_NAME"].filter(Boolean),
  }
}

async function fetchLead(id: string): Promise<Lead | null> {
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT * FROM leads WHERE id = $1', [id])
    if (!res.rows.length) return null
    const r = res.rows[0]
    return {
      id: r.id.toString(),
      company_name: r.company_name,
      website_url: r.website_url || undefined,
      industry: r.industry || undefined,
      location: r.location || undefined,
      contact_name: r.contact_name || undefined,
      email: r.email || undefined,
      phone: r.phone || undefined,
      status: r.status,
      notes: r.notes || undefined,
      source_url: r.source_url || undefined,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  } finally {
    client.release()
  }
}

export async function pushLeadToAirtable(id: string) {
  if (!envOk()) throw new Error('Airtable not configured (vars: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)')
  const lead = await fetchLead(id)
  if (!lead) throw new Error('Lead not found')
  const existing = await airtableFindByCompany(lead.company_name)
  if (existing) {
    const updated = await airtableUpdate(existing.id, lead)
    return { action: 'updated', recordId: updated.id }
  } else {
    const created = await airtableCreate(lead)
    return { action: 'created', recordId: created.id }
  }
}

export async function pushManyLeadsToAirtable(ids: string[]) {
  const results: any[] = []
  for (const id of ids) {
    try {
      const r = await pushLeadToAirtable(id)
      results.push({ id, ...r })
    } catch (e: any) {
      results.push({ id, error: e.message })
    }
    await new Promise(r => setTimeout(r, 120))
  }
  return results
}

async function airtableFindByCompany(company: string): Promise<AirtableRecord<any> | null> {
  const filter = encodeURIComponent(`{Company Name} = "${company.replace(/"/g,'\\"')}"`)
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?maxRecords=1&filterByFormula=${filter}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Airtable search failed (${res.status})`)
  const data = await res.json()
  if (data.records && data.records.length) return data.records[0]
  return null
}

function authHeaders() {
  return { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
}

function leadToFields(lead: Lead) {
  return {
    'Company Name': lead.company_name,
    'Website': lead.website_url,
    'Industry': lead.industry,
    'Location': lead.location,
    'Contact Name': lead.contact_name,
  'Contact Title': (lead as any).contact_title,
    'Email': lead.email,
    'Phone': lead.phone,
    'Status': lead.status,
    'Notes': lead.notes,
    'Source URL': lead.source_url,
    'Created At': lead.created_at,
  }
}

async function airtableCreate(lead: Lead): Promise<AirtableRecord<any>> {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ fields: leadToFields(lead) }] })
  })
  if (!res.ok) throw new Error(`Airtable create failed (${res.status})`)
  const data = await res.json()
  return data.records[0]
}

async function airtableUpdate(recordId: string, lead: Lead): Promise<AirtableRecord<any>> {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ records: [{ id: recordId, fields: leadToFields(lead) }] })
  })
  if (!res.ok) throw new Error(`Airtable update failed (${res.status})`)
  const data = await res.json()
  return data.records[0]
}

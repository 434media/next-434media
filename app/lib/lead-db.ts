import { pool } from "./db"
import type { Lead, LeadSearchParams, LeadStatus } from "../types/lead-types"

export async function initLeadTable() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(500) NOT NULL,
        website_url TEXT,
        industry VARCHAR(255),
        location VARCHAR(255),
        contact_name VARCHAR(255),
        contact_title VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        source_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_company_unique ON leads(company_name);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_name);
    `)
  } finally {
    client.release()
  }
}

export async function createLead(data: Omit<Lead, "id" | "created_at" | "updated_at">): Promise<Lead> {
  const client = await pool.connect()
  try {
    const result = await client.query(
  `INSERT INTO leads (company_name, website_url, industry, location, contact_name, contact_title, email, phone, status, notes, source_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        data.company_name,
        data.website_url || null,
        data.industry || null,
        data.location || null,
        data.contact_name || null,
    (data as any).contact_title || null,
        data.email || null,
        data.phone || null,
        data.status || "new",
        data.notes || null,
        data.source_url || null,
      ]
    )
    return mapRow(result.rows[0])
  } finally {
    client.release()
  }
}

export async function bulkUpsertLeads(leads: Array<Partial<Lead> & { company_name: string }>): Promise<number> {
  if (!leads.length) return 0
  const client = await pool.connect()
  try {
    let inserted = 0
    for (const l of leads) {
      await client.query(
        `INSERT INTO leads (company_name, website_url, industry, location, contact_name, contact_title, email, phone, status, notes, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (company_name) DO UPDATE SET
           website_url = COALESCE(EXCLUDED.website_url, leads.website_url),
           industry = COALESCE(EXCLUDED.industry, leads.industry),
           location = COALESCE(EXCLUDED.location, leads.location),
           contact_name = COALESCE(EXCLUDED.contact_name, leads.contact_name),
           contact_title = COALESCE(EXCLUDED.contact_title, leads.contact_title),
           email = COALESCE(EXCLUDED.email, leads.email),
           phone = COALESCE(EXCLUDED.phone, leads.phone),
           notes = COALESCE(EXCLUDED.notes, leads.notes),
           source_url = COALESCE(EXCLUDED.source_url, leads.source_url),
           updated_at = NOW();`,
        [
          l.company_name,
          l.website_url || null,
          l.industry || null,
          l.location || null,
          l.contact_name || null,
          (l as any).contact_title || null,
          l.email || null,
          l.phone || null,
          l.status || "new",
          l.notes || null,
          l.source_url || null,
        ]
      )
      inserted++
    }
    return inserted
  } finally {
    client.release()
  }
}

export async function listLeads(params: LeadSearchParams = {}): Promise<Lead[]> {
  const client = await pool.connect()
  try {
    const where: string[] = []
    const values: any[] = []
    if (params.search) {
      values.push(`%${params.search.toLowerCase()}%`)
      where.push(`LOWER(company_name) LIKE $${values.length}`)
    }
    if (params.status && params.status !== "all") {
      values.push(params.status)
      where.push(`status = $${values.length}`)
    }
    const limit = params.limit || 100
    const offset = params.offset || 0
    values.push(limit, offset)
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const result = await client.query(
      `SELECT * FROM leads ${whereSql} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    )
    return result.rows.map(mapRow)
  } finally {
    client.release()
  }
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
  const client = await pool.connect()
  try {
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
    for (const [k, v] of Object.entries(updates)) {
      if (k === "id" || v === undefined) continue
      fields.push(`${k} = $${idx}`)
      values.push(v)
      idx++
    }
    if (!fields.length) return await getLead(id)
    values.push(id)
    const result = await client.query(
      `UPDATE leads SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    )
    if (!result.rows.length) return null
    return mapRow(result.rows[0])
  } finally {
    client.release()
  }
}

export async function getLead(id: string): Promise<Lead | null> {
  const client = await pool.connect()
  try {
    const result = await client.query(`SELECT * FROM leads WHERE id = $1`, [id])
    if (!result.rows.length) return null
    return mapRow(result.rows[0])
  } finally {
    client.release()
  }
}

export async function exportLeadsCsv(): Promise<string> {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT l.*, (SELECT COUNT(*) FROM lead_contacts c WHERE c.lead_id = l.id) AS contacts_count
      FROM leads l ORDER BY l.created_at DESC
    `)
    const headers = [
      "id","company_name","website_url","industry","location","contact_name","contact_title","email","phone","status","notes","source_url","contacts_count","created_at","updated_at"
    ]
    const rows = result.rows.map(r => headers.map(h => (r[h] ?? "").toString().replace(/"/g,'""')))
    return [headers.join(","), ...rows.map(r=> r.map(c=>`"${c}"`).join(","))].join("\n")
  } finally { client.release() }
}

function mapRow(row: any): Lead {
  return {
    id: row.id.toString(),
    company_name: row.company_name,
    website_url: row.website_url || undefined,
    industry: row.industry || undefined,
    location: row.location || undefined,
    contact_name: row.contact_name || undefined,
    email: row.email || undefined,
  contact_title: row.contact_title || undefined,
    phone: row.phone || undefined,
    status: row.status as LeadStatus,
    notes: row.notes || undefined,
    source_url: row.source_url || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function addContacts(leadId: string, contacts: Array<{ name: string; title?: string; email?: string; phone?: string; linkedin_url?: string; twitter_url?: string }>) {
  if (!contacts.length) return 0
  const client = await pool.connect()
  try {
    for (const c of contacts.slice(0, 25)) {
      await client.query(
        `INSERT INTO lead_contacts (lead_id, name, title, email, phone, linkedin_url, twitter_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [leadId, c.name, c.title || null, c.email || null, c.phone || null, c.linkedin_url || null, c.twitter_url || null]
      )
    }
    return contacts.length
  } finally { client.release() }
}

export async function listContacts(leadId: string) {
  const client = await pool.connect()
  try {
    const r = await client.query('SELECT * FROM lead_contacts WHERE lead_id = $1 ORDER BY id ASC', [leadId])
    return r.rows
  } finally { client.release() }
}

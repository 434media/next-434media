import { bulkUpsertLeads, addContacts, initLeadTable } from './lead-db'
import { scrapeCore, CoreScrapeInput } from '../../shared/scraper-core'

export interface ScrapeInput {
  query?: string
  urls?: string[]
  industry?: string
  location?: string
  limit?: number
  deep?: boolean // optional; defaults to true unless explicitly false
  perSitePageLimit?: number // optional; defaults to 5 internal pages when deep
}

export interface ScrapeResultSummary {
  newLeads: number
  processedPages: number
  extracted: number
  errors: { url: string; message: string }[]
  leadsPreview: string[]
}

interface TempLeadCandidate {
  company_name: string
  website_url?: string
  industry?: string
  location?: string
  email?: string
  phone?: string
  source_url?: string
  contact_name?: string
  contact_title?: string
  contacts?: Array<{ name: string; title?: string; email?: string; phone?: string; linkedin_url?: string; twitter_url?: string }>
}

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const phoneRegex = /(\+?\d[\d\s().-]{8,}\d)/g

export async function runScrape(input: ScrapeInput): Promise<ScrapeResultSummary> {
  const { urls = [], industry, location } = input
  if (!urls.length) throw new Error('At least one URL required after preprocessing')
  await initLeadTable().catch(()=>{})
  const coreInput: CoreScrapeInput = { urls, industry, location, deep: input.deep, perSitePageLimit: input.perSitePageLimit, limit: input.limit }
  const core = await scrapeCore(coreInput)
  const deduped = core.candidates

  const inserted = await bulkUpsertLeads(
    deduped.map(d => ({
      company_name: d.company_name,
      website_url: d.website_url,
      industry: d.industry,
      location: d.location,
      email: d.email,
      phone: d.phone,
      source_url: d.source_url,
      contact_name: d.contact_name,
      contact_title: d.contact_title,
    }))
  )

  // Persist multi contacts best-effort: fetch IDs by company_name after upsert
  // (Simple approach: query each lead individually to get id)
  try {
    const { pool } = await import('./db')
    const client = await pool.connect()
    try {
      for (const c of deduped) {
        if (!c.contacts?.length) continue
        const res = await client.query('SELECT id FROM leads WHERE company_name = $1', [c.company_name])
        if (res.rows[0]) {
          await addContacts(res.rows[0].id.toString(), c.contacts)
        }
      }
    } finally { client.release() }
  } catch (err) {
    // Non-fatal
    console.error('Add contacts failed', err)
  }

  // Add multi-contacts (best-effort) after upsert
  // NOTE: We need the lead IDs; simplest approach: not fetching here to keep runtime small.
  // Future enhancement: map company_name back to ID with a SELECT.
  // Skipping persistence of extra contacts until we fetch IDs (left as TODO or optional optimization).

  return { newLeads: inserted, processedPages: core.processedPages, extracted: deduped.length, errors: core.errors, leadsPreview: deduped.slice(0, 10).map(l => l.company_name) }
}
// All detailed extraction logic moved into shared/scraper-core

import { SQSHandler } from 'aws-lambda'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { Pool } from 'pg'
import { scrapeCore } from './scraper-core'

let pool: Pool | null = null

const secretsClient = new SecretsManagerClient({})
let cachedSecrets: Record<string,string> | null = null

async function getSecret(name: string) {
  const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: name }))
  return res.SecretString || ''
}

async function loadSecrets() {
  if (cachedSecrets) return cachedSecrets
  const neon = await getSecret(process.env.NEON_DB_SECRET_NAME!)
  const airtable = await getSecret(process.env.AIRTABLE_API_SECRET_NAME!)
  cachedSecrets = { NEON_DATABASE_URL: neon, AIRTABLE_API_KEY: airtable }
  return cachedSecrets
}

async function ensurePool(connString: string) {
  if (!pool) pool = new Pool({ connectionString: connString })
  return pool
}

async function runJob(msg: any) {
  const { NEON_DATABASE_URL } = await loadSecrets()
  await ensurePool(NEON_DATABASE_URL)
  console.log('Running job', { msg })
  if (msg.jobType === 'nightly-enrichment') {
    return // enrichment placeholder
  }
  if (msg.jobType === 'scrape' && msg.urls?.length) {
    // Update job status -> running
    await pool!.query('UPDATE lead_jobs SET status = $1, started_at = NOW(), updated_at = NOW() WHERE job_id = $2', ['running', msg.jobId])
    try {
      const core = await scrapeCore({ urls: msg.urls, industry: msg.industry, location: msg.location, deep: msg.deep, perSitePageLimit: msg.perSitePageLimit, limit: msg.limit })
      // Persist leads (bulk upsert logic inline simplified)
      for (const d of core.candidates) {
        const upsertRes = await pool!.query(
          `INSERT INTO leads (company_name, website_url, industry, location, contact_name, contact_title, email, phone, status, notes, source_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',NULL,$9)
           ON CONFLICT (company_name) DO UPDATE SET
             website_url = COALESCE(EXCLUDED.website_url, leads.website_url),
             industry = COALESCE(EXCLUDED.industry, leads.industry),
             location = COALESCE(EXCLUDED.location, leads.location),
             contact_name = COALESCE(EXCLUDED.contact_name, leads.contact_name),
             contact_title = COALESCE(EXCLUDED.contact_title, leads.contact_title),
             email = COALESCE(EXCLUDED.email, leads.email),
             phone = COALESCE(EXCLUDED.phone, leads.phone),
             source_url = COALESCE(EXCLUDED.source_url, leads.source_url),
             updated_at = NOW();`,
          [d.company_name, d.website_url || null, d.industry || null, d.location || null, d.contact_name || null, d.contact_title || null, d.email || null, d.phone || null, d.source_url || null]
        )
        if (d.contacts?.length) {
          const idRes = await pool!.query('SELECT id FROM leads WHERE company_name = $1', [d.company_name])
          const leadId = idRes.rows[0]?.id
          if (leadId) {
            for (const c of d.contacts.slice(0,25)) {
              await pool!.query(
                `INSERT INTO lead_contacts (lead_id, name, title, email, phone, linkedin_url, twitter_url)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [leadId, c.name, c.title || null, c.email || null, c.phone || null, c.linkedin_url || null, c.twitter_url || null]
              )
            }
          }
        }
      }
      await pool!.query('UPDATE lead_jobs SET status=$1, finished_at=NOW(), updated_at=NOW() WHERE job_id = $2', ['complete', msg.jobId])
    } catch (err: any) {
      console.error('Scrape job failed', err)
      await pool!.query('UPDATE lead_jobs SET status=$1, error=$2, finished_at=NOW(), updated_at=NOW() WHERE job_id=$3', ['failed', err.message || 'error', msg.jobId])
      throw err
    }
  }
}

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const msg = JSON.parse(record.body)
      await runJob(msg)
    } catch (e: any) {
      console.error('Job failed', e)
      throw e // Let SQS retry
    }
  }
}

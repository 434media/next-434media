import { NextRequest, NextResponse } from 'next/server'
// Type import to help TS resolve the modular AWS SDK client
// (Actual code uses dynamic import to keep route bundle lean.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { SQSClient as _SQSType } from '@aws-sdk/client-sqs'
import { initLeadTable, createJob, getJob } from '@/app/lib/lead-db'

// Background scrape enqueue endpoint (Step 2)
// Expects: { urls: string[], industry?, location?, deep?, perSitePageLimit?, limit? }
// Returns: { status: 'queued', jobId }

export const runtime = 'nodejs'

interface EnqueueBody {
  urls?: string[]
  industry?: string
  location?: string
  deep?: boolean
  perSitePageLimit?: number
  limit?: number
}

// DB-backed jobs (memory fallback removed in Step 3)

function generateJobId() {
  return 'job_' + Math.random().toString(36).slice(2, 10)
}

async function sendToQueue(message: any) {
  const queueUrl = process.env.LEAD_SCRAPE_QUEUE_URL
  if (!queueUrl) throw new Error('LEAD_SCRAPE_QUEUE_URL not configured')
  // Lazy import AWS SDK v3 only when needed to keep edge bundle small (runtime=nodejs anyway)
  const mod: any = await import('@aws-sdk/client-sqs')
  const client = new mod.SQSClient({ region: process.env.AWS_REGION || 'us-east-1' })
  await client.send(new mod.SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }))
}

export async function POST(req: NextRequest) {
  let body: EnqueueBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const urls = (body.urls || []).map(u => u.trim()).filter(Boolean)
  if (!urls.length) return NextResponse.json({ error: 'urls required' }, { status: 400 })

  try {
    await initLeadTable().catch(()=>{})
    const jobId = generateJobId()
  const payload = { jobType: 'scrape', jobId, ...body, urls }
  await createJob({ job_id: jobId, type: 'scrape', payload })
  await sendToQueue(payload)
    return NextResponse.json({ status: 'queued', jobId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Enqueue failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('id')
  if (!jobId) return NextResponse.json({ error: 'id param required' }, { status: 400 })
  const job = await getJob(jobId)
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ jobId, status: job.status, started_at: job.started_at, finished_at: job.finished_at, error: job.error })
}

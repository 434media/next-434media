export type JobStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface LeadJob {
  id: string
  job_id: string
  type: string
  status: JobStatus
  payload?: any
  error?: string
  created_at: string
  updated_at: string
  started_at?: string
  finished_at?: string
}

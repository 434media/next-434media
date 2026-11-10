import { getDb } from "./firebase-admin"
import type { Heartbeat } from "./cron-watchdog"

/**
 * One document per cron job, `cron_heartbeats/<job>`, updated every time the job fires, whether or not it then does any
 * work or succeeds. The watchdog (lib/cron-watchdog.ts) reads these to find a job that never fired. One small document
 * per job, overwritten in place, so the collection never grows; `firstFiredAt` is set once, on the first beat.
 */
export const CRON_HEARTBEATS_COLLECTION = "cron_heartbeats"

/** Marks the job as fired now. Never throws: a heartbeat that cannot be written must not stop the job. */
export async function markCronFired(job: string, now = new Date()): Promise<void> {
  try {
    const ref = getDb().collection(CRON_HEARTBEATS_COLLECTION).doc(job)
    const at = now.toISOString()
    // One write in the steady state; the first beat creates the document with its first-fired time.
    await ref.update({ lastFiredAt: at }).catch(async (err: { code?: number }) => {
      if (err?.code !== 5) throw err // 5 = NOT_FOUND
      await ref.create({ job, lastFiredAt: at, firstFiredAt: at }).catch((e: { code?: number }) => {
        if (e?.code === 6) return ref.update({ lastFiredAt: at }) // 6 = ALREADY_EXISTS: a concurrent first beat
        throw e
      })
    })
  } catch (error) {
    console.error(`[cron:${job}] Failed to write heartbeat:`, error)
  }
}

export async function readCronHeartbeats(): Promise<Map<string, Heartbeat>> {
  const snap = await getDb().collection(CRON_HEARTBEATS_COLLECTION).get()
  const out = new Map<string, Heartbeat>()
  for (const d of snap.docs) {
    const v = d.data() as Partial<Heartbeat>
    if (typeof v.lastFiredAt === "string") out.set(d.id, { job: d.id, lastFiredAt: v.lastFiredAt, ...(typeof v.firstFiredAt === "string" ? { firstFiredAt: v.firstFiredAt } : {}) })
  }
  return out
}

/**
 * Exam reports, kept (V1 item 4, the proof slice). The exam route used to return its report only in the response, so a
 * report lived in the founder's browser tab and a run that hit the function's time limit left nothing. Now the route
 * writes `agent_exam_reports/<id>` when a run starts and again after every case, so whatever finished is kept, and a
 * founder-only GET reads it back.
 *
 * What is kept is the report's markdown and a compact line per case: status, reason, tokens, cost, time, and the
 * model's answer cut to `OUTPUT_CHARS`. Exam cases are invented, so a report holds no one's personal data. It never
 * goes into the agent ledger, which is for live tasks.
 *
 * The builders are pure; the reads and writes import firebase-admin lazily. This module lives outside lib/exam on
 * purpose: lib/exam imports nothing that can write (lib/__tests__/exam.test.ts).
 */
import type { ExamReport } from "../exam/runner"

export const EXAM_REPORTS_COLLECTION = "agent_exam_reports"
/** The model's answer per case, cut to this many characters: enough to read the draft, bounded for one document. */
export const OUTPUT_CHARS = 4_000
/** The markdown, bounded well under Firestore's 1 MiB document limit. */
export const MARKDOWN_CHARS = 200_000
/** A run still marked running after the route's time limit (800 s) plus a minute is reported as timed out. */
export const RUN_LIMIT_MS = 860_000

export type ExamRunStatus = "running" | "done" | "failed"

export interface StoredExamReport {
  id: string
  suite: string
  skill: string
  model: string
  /** The 434-context commit the skill and the suite were read at. */
  commit: string
  suiteSha256?: string
  /** Case ids when the run was a batch (`only`). */
  only?: string[]
  /** How many cases the run set out to do; `totals.cases` is how many it finished. */
  planned: number
  status: ExamRunStatus
  startedAt: string
  updatedAt: string
  finishedAt?: string
  error?: string
  totals?: ExamReport["totals"]
  cases: Array<{
    id: string
    title: string
    category: string
    status: string
    reason: string
    ms: number
    costUsd: number | null
    usage?: ExamReport["cases"][number]["usage"]
    model?: string
    output: string
    outputCut: boolean
  }>
  markdown: string
  by: "founder"
}

export interface ExamRunMeta {
  id: string
  suite: string
  skill: string
  model: string
  commit: string
  only?: string[]
  planned: number
  startedAt: string
}

/** The document at the start of a run: no cases yet. */
export function startedReport(meta: ExamRunMeta): StoredExamReport {
  return stripUndefined({ ...meta, status: "running", updatedAt: meta.startedAt, cases: [], markdown: "", by: "founder" })
}

/** The document for a report so far (`running`) or a finished one (`done`). */
export function reportDoc(meta: ExamRunMeta, report: ExamReport, markdown: string, status: ExamRunStatus, at: string): StoredExamReport {
  const doc: StoredExamReport = {
    ...startedReport(meta),
    status,
    updatedAt: at,
    suiteSha256: report.suite.sha256,
    totals: report.totals,
    cases: report.cases.map((c) => {
      const text = c.output.error ? `${c.output.error}\n${c.output.text ?? ""}` : (c.output.text ?? "")
      return {
        id: c.id,
        title: c.title,
        category: c.category,
        status: c.status,
        reason: c.reason,
        ms: c.ms,
        costUsd: c.costUsd,
        ...(c.usage ? { usage: c.usage } : {}),
        ...(c.output.model ? { model: c.output.model } : {}),
        output: text.slice(0, OUTPUT_CHARS),
        outputCut: text.length > OUTPUT_CHARS,
      }
    }),
    markdown: markdown.slice(0, MARKDOWN_CHARS),
  }
  if (status === "done") doc.finishedAt = report.finishedAt
  return stripUndefined(doc)
}

/** How a stored run reads now: a run left `running` past the time limit timed out, keeping the cases it finished. */
export function examRunState(r: Pick<StoredExamReport, "status" | "startedAt">, now: Date): ExamRunStatus | "timed-out" {
  if (r.status === "running" && now.getTime() - Date.parse(r.startedAt) > RUN_LIMIT_MS) return "timed-out"
  return r.status
}

function stripUndefined<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}

async function collection() {
  const { getDb } = await import("../firebase-admin")
  return getDb().collection(EXAM_REPORTS_COLLECTION)
}

export async function saveExamReport(doc: StoredExamReport): Promise<void> {
  await (await collection()).doc(doc.id).set(stripUndefined(doc))
}

/** Marks a run failed, keeping the cases and markdown it already saved. */
export async function markExamFailed(doc: Pick<StoredExamReport, "id" | "status" | "updatedAt" | "error">): Promise<void> {
  await (await collection()).doc(doc.id).set(stripUndefined({ status: doc.status, updatedAt: doc.updatedAt, error: doc.error }), { merge: true })
}

/** The newest reports, newest first, each with its state as of `now`. */
export async function listExamReports(limit = 10, now = new Date()): Promise<Array<StoredExamReport & { state: ExamRunStatus | "timed-out" }>> {
  const snap = await (await collection()).orderBy("startedAt", "desc").limit(limit).get()
  return snap.docs.map((d) => {
    const r = d.data() as StoredExamReport
    return { ...r, state: examRunState(r, now) }
  })
}

export async function getExamReport(id: string, now = new Date()): Promise<(StoredExamReport & { state: ExamRunStatus | "timed-out" }) | null> {
  const snap = await (await collection()).doc(id).get()
  if (!snap.exists) return null
  const r = snap.data() as StoredExamReport
  return { ...r, state: examRunState(r, now) }
}

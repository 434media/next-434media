"use client"

// The Agents page: the kill switch, intake's mode and send flag, the pin, the exams and the console (V1 item 4; moved
// here from /admin/review on the founder's one-work-area decision, 2026-11-16; Display Standard §3.15, Provisional).
// Drafts are decided in To do (/admin/todo), not here. Signal red
// marks state only (stopped, failures, checks needed); the destructive actions, Stop all and Reject, are neutral and
// each asks to confirm (coordinator 18, on the founder's delegation, 2026-11-14). Founder only: the page and every route it calls run the founder guard on the server.
// Nothing here sends on its own: a reply goes only when the founder presses Approve & send, and every control in
// lib/agent/send-email.ts still applies.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  MessageSquareText,
  Pin,
  Play,
  Power,
  RefreshCw,
  X,
} from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { StoredExamReport } from "@/lib/agent/exam-reports"
import { ASK_MODEL, usd as dollars } from "@/lib/ask/limits"
import type { CostSummary, HandoffWait, ReasonGroup, ReviewItem, RunSummary } from "@/lib/agent/review"

type Mode = "off" | "proof" | "draft"
interface Console {
  now: string
  controls: { stopped: boolean; stoppedAt?: string; skills: Record<string, Mode>; sends: Record<string, boolean>; ask?: boolean }
  pin: { commit: string; sha256: string; model?: string; ceiling: string; pinnedAt: string } | null
  askPin?: { commit: string; sha256: string; model?: string; ceiling: string; pinnedAt: string } | null
  askMonth?: { spentUsd: number | null; capUsd: number }
  queue: ReviewItem[]
  reasons: ReasonGroup[]
  runs: RunSummary
  waits: HandoffWait[]
  costs: CostSummary
}

const SKILL = "434-intake-qualification"
const ASK_SKILL = "admin-ask"
/** The Ask panel runs on Haiku, so its exam does too (lib/ask/limits.ts). */
const ASK_EXAM_MODEL = ASK_MODEL
const EXAM_STATE = { running: "Running", done: "Done", failed: "Failed", "timed-out": "Timed out" } as const
type StoredExam = Omit<StoredExamReport, "state"> & { state: keyof typeof EXAM_STATE }
interface ExamView {
  model: string
  markdown: string
  pass: number
  cases: number
  state?: keyof typeof EXAM_STATE
  error?: string
  outputs?: StoredExam["cases"]
}
const examView = (r: StoredExam): ExamView => ({ model: r.model, markdown: r.markdown, pass: r.totals?.pass ?? 0, cases: r.planned, state: r.state, error: r.error, outputs: r.cases })
const EXAM_MODELS = ["anthropic/claude-sonnet-5.5", "anthropic/claude-opus-5.5"]

function duration(ms: number | null): string {
  if (ms === null) return "—"
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m} min`
  const h = Math.round(m / 6) / 10
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—")
const usd = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`

function Pill({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "dark" | "amber" | "red" | "green"; title?: string }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-600",
    dark: "bg-neutral-900 text-white",
    amber: "bg-amber-50 text-amber-800 border border-amber-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    green: "bg-green-50 text-green-700 border border-green-200",
  }
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function AgentsConsole() {
  const [data, setData] = useState<Console | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [exam, setExam] = useState<ExamView | null>(null)
  const [examReports, setExamReports] = useState<StoredExam[] | null>(null)
  const loadExams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/engine/exam", { cache: "no-store" })
      const body = await res.json()
      if (res.ok) setExamReports(body.reports ?? [])
    } catch {
      // The panel says it could not read; the rest of the console stands.
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/review", { cache: "no-store" })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "The queue could not be read")
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The queue could not be read")
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const say = (type: "success" | "error", message: string) => setToast({ type, message })

  async function post(url: string, body: unknown): Promise<{ ok: boolean; body: Record<string, unknown> }> {
    setBusy(true)
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const out = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return { ok: res.ok, body: out }
    } finally {
      setBusy(false)
    }
  }

  async function controls(change: Record<string, unknown>, done: string) {
    if (change.action === "stop" && !window.confirm("Stop every agent now? Nothing new runs or sends, open tasks are cancelled, and anything caught mid-send goes to you to check.")) return
    const r = await post("/api/admin/agent/controls", change)
    if (r.ok) say("success", done)
    else say("error", String(r.body.error ?? "The switch could not be changed"))
    await load()
  }

  async function pinLatest(skill = SKILL) {
    const r = await post("/api/admin/agent/skills/pin", { skill, ref: "main" })
    if (r.ok) say("success", `Pinned ${skill === SKILL ? "the intake skill" : "the Ask skill"} at ${String((r.body.pin as { commit?: string })?.commit ?? "").slice(0, 7)}.`)
    else say("error", String(r.body.error ?? "The pin failed"))
    await load()
  }

  async function runExam(model: string, suite = "intake-qualification") {
    const what = suite === "admin-ask" ? "the Ask exam" : "the intake exam"
    if (!window.confirm(`Run ${what} on ${model}? It spends Gateway credit${suite === "admin-ask" ? "" : " and runs the skill's scripts in a sandbox"}. Every tool is a mock: it sends and changes nothing.`)) return
    const r = await post("/api/admin/engine/exam", { suite, model })
    void loadExams()
    if (!r.ok) {
      say("error", String(r.body.error ?? "The exam could not run. Any cases it finished are kept under Exam reports in the Console."))
      return
    }
    const totals = (r.body.report as { totals?: { pass?: number; cases?: number } })?.totals ?? {}
    setExam({ model, markdown: String(r.body.markdown ?? ""), pass: totals.pass ?? 0, cases: totals.cases ?? 0 })
  }

  return (
    <div className="min-dvh bg-neutral-50 text-neutral-900">
      {toast && (
        <div className="fixed top-[max(env(safe-area-inset-top),0.75rem)] inset-x-3 sm:inset-x-auto sm:top-20 sm:right-4 z-50 flex justify-center sm:block">
          <div role="status" className={`flex items-start gap-2 max-w-md rounded-lg border px-3 py-2 text-sm shadow-sm ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} aria-label="Dismiss notification" className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-neutral-900">Agents</h1>
            <p className="mt-1 text-sm text-neutral-500">
              The switch, the modes, the pinned skill and what the agents cost. Drafts are decided in{" "}
              <Link href="/admin/todo" className="font-medium text-neutral-800 underline underline-offset-2">To do</Link>. Visible to the founder only.
            </p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
        {!data && !error && <p className="text-sm text-neutral-500">Loading…</p>}

        {data && (
          <>
            <ControlsBar data={data} busy={busy} onControls={controls} onPin={() => pinLatest()} onExam={runExam} />
            <AskBar data={data} busy={busy} onControls={controls} onPin={() => pinLatest(ASK_SKILL)} onExam={(m) => runExam(m, "admin-ask")} />

            <ConsoleView data={data} exams={examReports} onLoadExams={loadExams} onOpenExam={(r) => setExam(examView(r))} />
          </>
        )}
      </main>

      {exam && (
        <DetailDrawer open onClose={() => setExam(null)} title="Exam" subtitle={`${exam.model}: ${exam.pass} of ${exam.cases} cases pass${exam.state && exam.state !== "done" ? ` · ${EXAM_STATE[exam.state]}` : ""}`} width="xl">
          {exam.error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{exam.error}</p>}
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-700">{exam.markdown || "No case finished yet."}</pre>
          {exam.outputs?.map((o) => (
            <details key={o.id} className="mt-3 rounded-lg border border-neutral-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-700">
                <span className="font-mono">{o.id}</span> · {o.status}
              </summary>
              <pre className="whitespace-pre-wrap border-t border-neutral-100 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-700">{o.output || "No answer."}{o.outputCut ? "\n…" : ""}</pre>
            </details>
          ))}
        </DetailDrawer>
      )}
    </div>
  )
}

function ControlsBar({ data, busy, onControls, onPin, onExam }: { data: Console; busy: boolean; onControls: (c: Record<string, unknown>, done: string) => void; onPin: () => void; onExam: (model: string) => void }) {
  const mode = data.controls.skills[SKILL] ?? "off"
  const sends = data.controls.sends.intake_reply === true
  const stopped = data.controls.stopped
  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex items-center gap-2 lg:w-56">
        <Power className={`w-4 h-4 ${stopped ? "text-red-600" : "text-green-600"}`} />
        <div>
          <div className="text-sm font-medium">{stopped ? "Agents stopped" : "Agents running"}</div>
          <div className="text-xs text-neutral-500">{stopped ? `Since ${when(data.controls.stoppedAt)}` : "Checked before every send"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {stopped ? (
          <button disabled={busy} onClick={() => onControls({ action: "resume" }, "Resumed. Modes and send flags are as they were.")} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        ) : (
          <button disabled={busy} onClick={() => onControls({ action: "stop" }, "Stopped. Nothing new runs or sends.")} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-40">
            <Power className="w-3.5 h-3.5" /> Stop all
          </button>
        )}
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-neutral-400 ml-1">Intake</span>
        <div role="radiogroup" aria-label="Intake mode" className="flex gap-1 rounded-lg border border-neutral-200 p-0.5">
          {(["off", "proof", "draft"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} disabled={busy} onClick={() => onControls({ intakeMode: m }, `Intake is now ${m}.`)} title={m === "off" ? "No arrival gets a draft" : m === "proof" ? "Only the test address gets a draft" : "Every website arrival gets a draft for you"} className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize disabled:opacity-40 ${mode === m ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {m}
            </button>
          ))}
        </div>
        <button disabled={busy} onClick={() => onControls({ intakeSends: !sends }, sends ? "Intake sends are off." : "Intake sends are on. Each still needs your approval.")} className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${sends ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}>
          Sends {sends ? "on" : "off"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500" title={data.pin ? `Fingerprint ${data.pin.sha256.slice(0, 12)}, ceiling ${data.pin.ceiling}` : undefined}>
          {data.pin ? (
            <>
              Skill <span className="font-mono">{data.pin.commit.slice(0, 7)}</span>
              {data.pin.model ? ` · ${data.pin.model.replace("anthropic/", "")}` : ""}
            </>
          ) : (
            "Skill not pinned"
          )}
        </span>
        <button disabled={busy} onClick={onPin} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
          <Pin className="w-3.5 h-3.5" /> Pin latest
        </button>
        {EXAM_MODELS.map((m) => (
          <button key={m} disabled={busy} onClick={() => onExam(m)} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
            <FlaskConical className="w-3.5 h-3.5" /> Exam: {m.replace("anthropic/claude-", "")}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The Ask panel's row (V1 item 4, Ask panel slice 1): its on/off, its pin and its exam. Off at merge. On, the panel
 * runs for the founder and for anyone he grants `skill:admin-ask` on the roster; a stop turns it off with the rest.
 */
function AskBar({ data, busy, onControls, onPin, onExam }: { data: Console; busy: boolean; onControls: (c: Record<string, unknown>, done: string) => void; onPin: () => void; onExam: (model: string) => void }) {
  const on = data.controls.ask === true
  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex items-center gap-2 lg:w-56">
        <MessageSquareText className="w-4 h-4 text-neutral-500" />
        <div>
          <div className="text-sm font-medium">Ask panel</div>
          <div className="text-xs text-neutral-500">{data.controls.stopped ? "Off while agents are stopped" : on ? "On for you and anyone you grant" : "Off for everyone"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <button
          disabled={busy || (!on && !data.askPin)}
          title={!on && !data.askPin ? "Pin the Ask skill first" : undefined}
          onClick={() => onControls({ ask: !on }, on ? "Ask is off for everyone." : "Ask is on. Open it from the sidebar or with ⌘J.")}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${on ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"}`}
        >
          Ask {on ? "on" : "off"}
        </button>
        <span className="text-xs text-neutral-500">Reads, triage and task edits with Undo; stage changes by Confirm; never sends or touches money.</span>
        {data.askMonth && (
          <span className={`text-xs tabular-nums ${data.askMonth.spentUsd !== null && data.askMonth.spentUsd >= data.askMonth.capUsd ? "font-medium text-red-700" : "text-neutral-700"}`} title="Ask's model spend this calendar month (UTC). At the limit the panel stops until the 1st.">
            This month: {data.askMonth.spentUsd === null ? "unavailable" : `$${data.askMonth.spentUsd.toFixed(2)}`} of {dollars(data.askMonth.capUsd)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500" title={data.askPin ? `Fingerprint ${data.askPin.sha256.slice(0, 12)}, ceiling ${data.askPin.ceiling}` : undefined}>
          {data.askPin ? (
            <>
              Skill <span className="font-mono">{data.askPin.commit.slice(0, 7)}</span>
              {data.askPin.model ? ` · ${data.askPin.model.replace("anthropic/", "")}` : ""}
            </>
          ) : (
            "Skill not pinned"
          )}
        </span>
        <button disabled={busy} onClick={onPin} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
          <Pin className="w-3.5 h-3.5" /> Pin latest
        </button>
        <button disabled={busy} onClick={() => onExam(ASK_EXAM_MODEL)} className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40">
          <FlaskConical className="w-3.5 h-3.5" /> Exam: {ASK_EXAM_MODEL.replace("anthropic/claude-", "")}
        </button>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Rows({ rows, empty }: { rows: [string, string][]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-neutral-500">{empty}</p>
  return (
    <dl className="divide-y divide-neutral-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5 text-xs">
          <dt className="truncate text-neutral-600 font-mono">{k}</dt>
          <dd className="tabular-nums text-neutral-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ConsoleView({ data, exams, onLoadExams, onOpenExam }: { data: Console; exams: StoredExam[] | null; onLoadExams: () => void; onOpenExam: (r: StoredExam) => void }) {
  useEffect(() => {
    onLoadExams()
  }, [onLoadExams])
  const waiting = data.queue.filter((i) => i.status === "pending")
  const states = Object.entries(data.runs.byState) as [string, number][]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Approvals waiting">
        <Rows rows={waiting.map((i) => [i.subject, `${duration(i.waitingMs)}${i.late ? " · late" : ""}`])} empty="Nothing waiting." />
        {waiting.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            Decide them in <Link href="/admin/todo" className="font-medium text-neutral-800 underline underline-offset-2">To do</Link>. Past 24 hours, the watchdog emails you.
          </p>
        )}
      </Card>
      <Card title="Runs this week, by state">
        <Rows rows={states.map(([k, v]) => [k.replace(/_/g, " "), String(v)])} empty="No runs this week." />
      </Card>
      <Card title="Failures and checks needed">
        <Rows rows={data.runs.failures.map((f) => [f.taskId, `${f.state.replace(/_/g, " ")}${f.reasonCode ? ` · ${f.reasonCode}` : ""}`])} empty="None this week." />
      </Card>
      <Card title="How long work waits">
        <Rows rows={data.waits.map((w) => [w.label, w.samples ? `median ${duration(w.medianMs)} · longest ${duration(w.maxMs)} · ${w.samples}` : "—"])} empty="No handoffs yet." />
      </Card>
      <Card title={`Model cost, last 7 days: ${usd(data.costs.totalUsd)}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">By day</div>
            <Rows rows={data.costs.byDay.map((r) => [r.key, `${usd(r.usd)} · ${r.calls}`])} empty="No calls." />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">By brand</div>
            <Rows rows={data.costs.byProperty.map((r) => [r.key, usd(r.usd)])} empty="No calls." />
          </div>
        </div>
        <div className="mt-3 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Costliest tasks</div>
        <Rows rows={data.costs.byTask.map((r) => [r.key, usd(r.usd)])} empty="No calls." />
      </Card>
      <Card title="Exam reports">
        {exams === null ? (
          <p className="text-xs text-neutral-500">Loading…</p>
        ) : exams.length ? (
          <ul className="divide-y divide-neutral-100">
            {exams.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpenExam(r)} className="flex w-full items-center gap-2 py-1.5 text-left text-xs hover:bg-neutral-50">
                  <span className="flex-1 truncate">{r.model.replace("anthropic/claude-", "")}{r.only ? ` · batch of ${r.only.length}` : ""}</span>
                  <span className="text-neutral-500">{r.totals?.pass ?? 0} of {r.planned} pass{r.state !== "done" ? ` · ${r.totals?.cases ?? 0} finished` : ""}</span>
                  {r.state !== "done" && <Pill tone={r.state === "running" ? "neutral" : "red"}>{EXAM_STATE[r.state]}</Pill>}
                  <span className="w-28 text-right text-neutral-400">{r.startedAt.slice(0, 16).replace("T", " ")}Z</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">No exam has run since reports were kept.</p>
        )}
      </Card>
      <Card title="Your reasons this week">
        {data.reasons.length ? (
          <ul className="space-y-2">
            {data.reasons.map((g) => (
              <li key={`${g.decision}:${g.code}`} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{g.code}</span>
                  <span className="text-neutral-500">{g.decision} · {g.count}×</span>
                  {g.proposeRule && <Pill tone="dark" title="Repeated three or more times this week. A proposed rule for you to approve; nothing applies it.">Proposed rule</Pill>}
                </div>
                {g.examples.map((e, n) => (
                  <p key={n} className="mt-0.5 text-neutral-600">“{e}”</p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-neutral-500">No decisions this week.</p>
        )}
      </Card>
    </div>
  )
}

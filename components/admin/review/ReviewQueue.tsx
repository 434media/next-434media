"use client"

// The founder-review queue and the console (V1 item 4, the proof slice; Display Standard §3.15, Provisional, drafted
// for the founder's direction). Founder only: the page and every route it calls run the founder guard on the server.
// Nothing here sends on its own: a reply goes only when the founder presses Approve & send, and every control in
// lib/agent/send-email.ts still applies.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FlaskConical,
  Gauge,
  Pin,
  Play,
  Power,
  RefreshCw,
  X,
} from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { CostSummary, HandoffWait, ReasonGroup, ReviewItem, RunSummary } from "@/lib/agent/review"

type Mode = "off" | "proof" | "draft"
interface Console {
  now: string
  controls: { stopped: boolean; stoppedAt?: string; skills: Record<string, Mode>; sends: Record<string, boolean> }
  pin: { commit: string; sha256: string; model?: string; ceiling: string; pinnedAt: string } | null
  queue: ReviewItem[]
  reasons: ReasonGroup[]
  runs: RunSummary
  waits: HandoffWait[]
  costs: CostSummary
}

const SKILL = "434-intake-qualification"
const REASONS = {
  approved: [
    { code: "as-drafted", label: "Right as drafted" },
    { code: "routing-right", label: "Routing is right" },
    { code: "proof-run", label: "Proof run" },
    { code: "other", label: "Other" },
  ],
  rejected: [
    { code: "tone", label: "Tone or voice" },
    { code: "facts", label: "Wrong or missing facts" },
    { code: "routing", label: "Wrong routing" },
    { code: "not-now", label: "Not the right time" },
    { code: "handle-myself", label: "I'll handle it myself" },
    { code: "other", label: "Other" },
  ],
} as const
const EXAM_MODELS = ["anthropic/claude-sonnet-5.5", "anthropic/claude-opus-5.5"]

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  approved: "Approved",
  scheduled: "Scheduled",
  rejected: "Rejected",
  expired: "Expired",
  sending: "Sending",
  sent: "Sent",
  stopped: "Stopped",
  needs_reconciliation: "Check needed",
}

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

export function ReviewQueue() {
  const [data, setData] = useState<Console | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"waiting" | "decided" | "console">("waiting")
  const [open, setOpen] = useState<ReviewItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [exam, setExam] = useState<{ model: string; markdown: string; pass: number; cases: number } | null>(null)

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

  async function pinLatest() {
    const r = await post("/api/admin/agent/skills/pin", { ref: "main" })
    if (r.ok) say("success", `Pinned the intake skill at ${String((r.body.pin as { commit?: string })?.commit ?? "").slice(0, 7)}.`)
    else say("error", String(r.body.error ?? "The pin failed"))
    await load()
  }

  async function runExam(model: string) {
    if (!window.confirm(`Run the intake exam on ${model}? It spends Gateway credit and runs the skill's scripts in a sandbox. It sends nothing.`)) return
    const r = await post("/api/admin/engine/exam", { suite: "intake-qualification", model })
    if (!r.ok) {
      say("error", String(r.body.error ?? "The exam could not run"))
      return
    }
    const totals = (r.body.report as { totals?: { pass?: number; cases?: number } })?.totals ?? {}
    setExam({ model, markdown: String(r.body.markdown ?? ""), pass: totals.pass ?? 0, cases: totals.cases ?? 0 })
  }

  const waiting = useMemo(() => data?.queue.filter((i) => i.status === "pending") ?? [], [data])
  const decided = useMemo(() => data?.queue.filter((i) => i.status !== "pending") ?? [], [data])
  const late = waiting.filter((i) => i.late).length

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
            <h1 className="text-lg font-semibold text-neutral-900">Review</h1>
            <p className="mt-1 text-sm text-neutral-500">Drafts waiting for your decision. Nothing is sent without your approval. Visible to the founder only.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
        {!data && !error && <p className="text-sm text-neutral-500">Loading…</p>}

        {data && (
          <>
            <ControlsBar data={data} busy={busy} onControls={controls} onPin={pinLatest} onExam={runExam} />

            <div role="tablist" className="mb-4 flex gap-1 rounded-lg bg-white border border-neutral-200 p-1 w-full sm:w-auto overflow-x-auto">
              {([
                ["waiting", `Waiting ${waiting.length}`, ClipboardCheck],
                ["decided", `Decided ${decided.length}`, CheckCircle2],
                ["console", "Console", Gauge],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${tab === key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {late > 0 && tab !== "console" && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {late} draft{late === 1 ? " has" : "s have"} waited more than 24 hours.
              </p>
            )}

            {tab === "waiting" && <QueueList items={waiting} empty="Nothing waiting. Every draft has a decision." onOpen={setOpen} />}
            {tab === "decided" && <QueueList items={decided} empty="No decisions yet." onOpen={setOpen} />}
            {tab === "console" && <ConsoleView data={data} />}
          </>
        )}
      </main>

      {open && (
        <ReviewDrawer
          item={open}
          busy={busy}
          onClose={() => setOpen(null)}
          onDecide={async (decision, reasonCode, reason, send) => {
            const r = await post(`/api/admin/review/${encodeURIComponent(open.id)}`, { decision, shownHash: open.hash, reasonCode, reason, send })
            const sent = r.body.sent as { sent?: boolean; reason?: string; code?: string } | undefined
            if (!r.ok && !r.body.decided) say("error", String(r.body.error ?? "The decision was not recorded"))
            else if (decision === "rejected") say("success", "Rejected. Your reason is recorded.")
            else if (sent?.sent) say("success", "Approved and sent. The sent text is kept on the CRM record.")
            else if (sent) say("error", `Approved, not sent: ${sent.reason ?? sent.code}`)
            else say("success", "Approved.")
            setOpen(null)
            await load()
          }}
        />
      )}

      {exam && (
        <DetailDrawer open onClose={() => setExam(null)} title="Intake exam" subtitle={`${exam.model}: ${exam.pass} of ${exam.cases} cases pass`} width="xl">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-700">{exam.markdown}</pre>
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
          <button disabled={busy} onClick={() => onControls({ action: "stop" }, "Stopped. Nothing new runs or sends.")} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40">
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

const OUTCOME_LABEL: Record<string, string> = {
  qualified: "Qualified",
  clarify: "Clarify",
  discovery: "Discovery",
  flag: "Flag to you",
  decline: "Decline",
  "route-ntooitive": "Route to Ntooitive",
  "ampd-intake": "AMPD intake",
}

function QueueList({ items, empty, onOpen }: { items: ReviewItem[]; empty: string; onOpen: (i: ReviewItem) => void }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">{empty}</div>
  return (
    <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
      {items.map((i) => (
        <li key={i.id}>
          <button onClick={() => onOpen(i)} className="w-full flex flex-col md:flex-row md:items-center gap-2 md:gap-3 px-4 py-3 text-left hover:bg-neutral-50">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-900">{i.subject}</span>
                <span className="text-xs text-neutral-500">to {i.to.join(", ")}</span>
                {i.outcome && <Pill tone={i.outcome === "flag" ? "amber" : "neutral"}>{OUTCOME_LABEL[i.outcome] ?? i.outcome}</Pill>}
                {i.flag && <Pill tone="amber" title={i.flag}><AlertTriangle className="w-2.5 h-2.5" /> Flag</Pill>}
                {i.taskCancelled && <Pill tone="red">Cancelled</Pill>}
              </div>
              <p className="mt-0.5 truncate text-xs text-neutral-500">{i.reviewReason}</p>
            </div>
            <div className="flex items-center gap-2 md:w-48 md:justify-end text-xs text-neutral-500">
              {i.status === "pending" ? (
                <span className={`inline-flex items-center gap-1 ${i.late ? "text-amber-700 font-medium" : ""}`}>
                  <Clock className="w-3.5 h-3.5" /> {duration(i.waitingMs)}
                </span>
              ) : (
                <Pill tone={i.status === "sent" ? "green" : i.status === "needs_reconciliation" || i.status === "stopped" ? "red" : "neutral"}>{STATUS_LABEL[i.status] ?? i.status}</Pill>
              )}
              <span>{when(i.createdAt)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-0.5 text-sm text-neutral-800">{children}</div>
    </div>
  )
}

function ReviewDrawer({ item, busy, onClose, onDecide }: { item: ReviewItem; busy: boolean; onClose: () => void; onDecide: (d: "approved" | "rejected", code: string, reason: string, send: boolean) => void }) {
  const [decision, setDecision] = useState<"approved" | "rejected">("approved")
  const [code, setCode] = useState<string>(REASONS.approved[0].code)
  const [reason, setReason] = useState("")
  const [showRecord, setShowRecord] = useState(false)
  const pending = item.status === "pending" && !item.taskCancelled
  const pick = (d: "approved" | "rejected") => {
    setDecision(d)
    setCode(REASONS[d][0].code)
  }
  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={item.subject}
      subtitle={`To ${item.to.join(", ")}`}
      badge={<Pill tone={item.status === "pending" ? "dark" : "neutral"}>{STATUS_LABEL[item.status] ?? item.status}</Pill>}
      width="lg"
      footer={
        pending ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 rounded-lg border border-neutral-200 p-0.5 w-fit">
              {(["approved", "rejected"] as const).map((d) => (
                <button key={d} onClick={() => pick(d)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${decision === d ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
                  {d === "approved" ? "Approve" : "Reject"}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Reason" className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm sm:w-56">
                {REASONS[decision].map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </select>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Why, in a sentence (recorded)" aria-label="Your reason" className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
              <button disabled={busy || !reason.trim()} onClick={() => onDecide(decision, code, reason, decision === "approved")} className={`rounded-md px-3 py-2 text-xs font-medium text-white disabled:opacity-40 ${decision === "approved" ? "bg-neutral-900 hover:bg-neutral-800" : "bg-red-600 hover:bg-red-700"}`}>
                {decision === "approved" ? "Approve & send" : "Reject"}
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Why this is here</div>
          <p className="mt-0.5 text-sm text-neutral-800">{item.reviewReason}</p>
        </div>
        {item.flag && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {item.flag}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Routing">{item.outcome ? OUTCOME_LABEL[item.outcome] ?? item.outcome : "—"}</Field>
          <Field label="Arrived">{when(item.receivedAt)}</Field>
          <Field label="From">{item.from}</Field>
          <Field label="Reply-to">{item.replyTo ?? "—"}</Field>
          <Field label="Approval expires">{when(item.expiresAt)}</Field>
          <Field label="Model">{item.model ? <span className="font-mono text-xs">{item.model.replace("anthropic/", "")}</span> : "—"}</Field>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">The reply, exactly as it will be sent</div>
          <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-3">
            <div className="text-sm font-medium text-neutral-900">{item.subject}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{item.text}</p>
          </div>
          <p className="mt-1 font-mono text-[10px] text-neutral-400">hash {item.hash.slice(0, 12)}</p>
        </div>
        {item.handoff && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Next owner">{item.handoff.nextOwner ?? "—"}</Field>
            <Field label="Due">{item.handoff.due ?? "—"}</Field>
            <Field label="Back to a person if">{item.handoff.returnCondition ?? "—"}</Field>
          </div>
        )}
        {item.record && (
          <div>
            <button onClick={() => setShowRecord((v) => !v)} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
              {showRecord ? "Hide" : "Show"} the intake record
            </button>
            {showRecord && <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-700">{item.record}</pre>}
          </div>
        )}
        {item.decision && (
          <Field label={item.decision.decision === "approved" ? "Approved" : "Rejected"}>
            {when(item.decision.at)} · <span className="font-mono text-xs">{item.decision.reasonCode}</span> · {item.decision.reason}
          </Field>
        )}
        {item.sent && (
          <Field label="Sent">
            {when(item.sent.at)} · <span className="font-mono text-xs">{item.sent.messageId}</span>
          </Field>
        )}
        {item.taskCancelled && <p className="text-xs text-red-700">This task was cancelled by a stop. It cannot be decided or sent.</p>}
      </div>
    </DetailDrawer>
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

function ConsoleView({ data }: { data: Console }) {
  const waiting = data.queue.filter((i) => i.status === "pending")
  const states = Object.entries(data.runs.byState) as [string, number][]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Approvals waiting">
        <Rows rows={waiting.map((i) => [i.subject, `${duration(i.waitingMs)}${i.late ? " · late" : ""}`])} empty="Nothing waiting." />
        {waiting.length > 0 && <p className="mt-2 text-xs text-neutral-500">Each with its reason in the Waiting tab. Past 24 hours, the watchdog emails you.</p>}
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

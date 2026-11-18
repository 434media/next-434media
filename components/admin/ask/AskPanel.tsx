"use client"

// The Ask panel (V1 item 4, Ask panel slice 1; founder approval 2026-11-18; Display Standard §3.17, Provisional). A
// drawer from the right on every admin page, opened from the sidebar's Ask button or ⌘J (⌘K stays the command
// palette). One question at a time goes to POST /api/admin/ask; the conversation lives in this tab only and is never
// stored. A change made by an answer shows as a dark card with Undo for 6 seconds (as triage's toast in §3.14); a
// stage change shows as a Confirm card and changes nothing until the person confirms. Confirm is never red.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertCircle, ArrowRight, Check, Loader2, Undo2, X } from "lucide-react"

const UNDO_SHOWN_MS = 6_000

interface Edit {
  kind: "task" | "triage"
  id: string
  label: string
  undoUntil: string
}
interface Proposal {
  kind: "opportunity" | "person"
  id: string
  name: string
  from: string | null
  to: string
  hash: string
  label: string
}
type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; taskId?: string; edits?: Edit[]; proposals?: Proposal[]; link?: { href: string; label: string }; error?: boolean }

export interface AskStatus {
  on: boolean
  permitted: boolean
  founder: boolean
}

export function AskPanel({ open, onClose, status }: { open: boolean; onClose: () => void; status: AskStatus | null }) {
  const pathname = usePathname() ?? ""
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [turns, busy])

  const lastTask = [...turns].reverse().find((t): t is Extract<Turn, { role: "assistant" }> => t.role === "assistant" && !!t.taskId)?.taskId

  const ask = useCallback(async () => {
    const question = draft.trim()
    if (!question || busy) return
    const history = turns.map((t) => ({ role: t.role, content: t.text }))
    setTurns((ts) => [...ts, { role: "user", text: question }])
    setDraft("")
    setBusy(true)
    try {
      const res = await fetch("/api/admin/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, history, page: pathname }) })
      const body = await res.json().catch(() => ({}))
      if (body?.ok) {
        setTurns((ts) => [...ts, { role: "assistant", text: body.answer, taskId: body.taskId, edits: body.edits, proposals: body.proposals }])
      } else {
        setTurns((ts) => [...ts, { role: "assistant", text: body?.message ?? body?.error ?? "Ask could not answer. Try again.", link: body?.link, error: !res.ok }])
      }
    } catch {
      setTurns((ts) => [...ts, { role: "assistant", text: "Ask could not be reached. Nothing was changed.", error: true }])
    } finally {
      setBusy(false)
    }
  }, [draft, busy, turns, pathname])

  if (!open) return null
  const ready = status?.on && status.permitted

  return (
    <aside
      role="dialog"
      aria-label="Ask"
      className="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[440px] flex-col border-l border-neutral-200 bg-white text-neutral-900 shadow-[-12px_0_32px_rgba(0,0,0,0.06)]"
    >
      <header className="flex items-start gap-3 border-b border-neutral-200 px-5 py-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold">Ask</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Sees what you can see. Every change is logged.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Ask" className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100">
          <X className="h-[18px] w-[18px]" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4 text-sm leading-[1.45]">
        {!status && <p className="text-xs text-neutral-500">Reading…</p>}
        {status && !ready && (
          <p className="text-sm text-neutral-600">
            {!status.on ? "Ask is switched off." : "Ask isn't turned on for you. The founder grants it."}
            {status.founder && !status.on && (
              <>
                {" "}
                <Link href="/admin/agents" onClick={onClose} className="font-medium text-neutral-900 underline underline-offset-2">Turn it on in Agents</Link>.
              </>
            )}
          </p>
        )}
        {ready && turns.length === 0 && (
          <p className="text-sm text-neutral-500">{"Ask about what's waiting, people, organizations, opportunities and tasks. It can triage an arrival and change a task's due date, status or assignee, with Undo. Stage changes wait for your Confirm. It never sends and doesn't handle money."}</p>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="max-w-[320px] self-end whitespace-pre-wrap rounded-xl bg-neutral-100 px-3 py-2.5">{t.text}</div>
          ) : (
            <AssistantTurn key={i} turn={t} onNavigate={onClose} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <footer className="flex flex-col gap-2 border-t border-neutral-200 px-5 pb-4 pt-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask()
          }}
        >
          <label htmlFor="ask-input" className="sr-only">Ask a question</label>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={!ready || busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void ask()
              }
            }}
            placeholder="Ask about people, tasks, what's waiting…"
            className="min-h-11 max-h-32 flex-1 resize-none rounded-[10px] border border-neutral-300 px-3 py-[11px] text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none disabled:bg-neutral-50"
          />
          <button type="submit" aria-label="Send question" disabled={!ready || busy || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-neutral-900 text-white disabled:opacity-40">
            <ArrowRight className="h-[18px] w-[18px]" />
          </button>
        </form>
        <div className="flex justify-between gap-3 text-[11px] text-neutral-500">
          <span>Small edits: Undo. Stage changes: Confirm. Never sends or touches money.</span>
          {lastTask && <span className="shrink-0 font-mono" title="The ledger task for the last answer">{lastTask.slice(0, 12)}</span>}
        </div>
      </footer>
    </aside>
  )
}

function AssistantTurn({ turn, onNavigate }: { turn: Extract<Turn, { role: "assistant" }>; onNavigate: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`whitespace-pre-wrap ${turn.error ? "text-neutral-700" : ""}`}>
        {turn.error && <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-red-700" aria-label="Error" />}
        {turn.text}
      </div>
      {turn.link && (
        <Link href={turn.link.href} onClick={onNavigate} className="inline-flex items-center gap-1.5 self-start rounded-full border border-neutral-900 px-3 py-1.5 text-[13px] font-medium">
          {turn.link.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
      {turn.edits?.map((e) => <EditCard key={e.id} edit={e} taskId={turn.taskId} />)}
      {turn.proposals?.map((p) => <ConfirmCard key={`${p.kind}:${p.id}:${p.to}`} proposal={p} taskId={turn.taskId} />)}
    </div>
  )
}

function EditCard({ edit, taskId }: { edit: Edit; taskId?: string }) {
  const [state, setState] = useState<"applied" | "undoing" | "undone">("applied")
  const [error, setError] = useState<string | null>(null)
  const [undoShown, setUndoShown] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setUndoShown(false), UNDO_SHOWN_MS)
    return () => window.clearTimeout(t)
  }, [])

  async function undo() {
    setState("undoing")
    setError(null)
    try {
      const res = await fetch("/api/admin/ask/undo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: edit.kind, id: edit.id, taskId }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "The undo failed.")
      setState("undone")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The undo failed.")
      setState("applied")
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="status" className="flex items-center gap-2.5 rounded-[10px] bg-neutral-900 px-3 py-2.5 text-[13px] text-white">
        {state === "undone" ? <Undo2 className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0 text-green-400" />}
        <span className="flex-1">{state === "undone" ? `Undone: ${edit.label}` : edit.label}</span>
        {state !== "undone" && undoShown && (
          <button type="button" disabled={state === "undoing"} onClick={() => void undo()} className="min-h-8 rounded-md bg-white/20 px-3 py-1.5 text-[13px] text-white hover:bg-white/30 disabled:opacity-60">
            {state === "undoing" ? "Undoing…" : "Undo"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

const STAGE_NOTE: Record<string, string> = {
  closed_won: "Won counts the opportunity as won and records the win. Nothing changes until you confirm.",
  customer: "A customer never moves back to lead or contact. Nothing changes until you confirm.",
}

function ConfirmCard({ proposal, taskId }: { proposal: Proposal; taskId?: string }) {
  const [state, setState] = useState<"open" | "working" | "confirmed" | "cancelled">("open")
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setState("working")
    setError(null)
    try {
      const res = await fetch("/api/admin/ask/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId, kind: proposal.kind, id: proposal.id, to: proposal.to, hash: proposal.hash }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error ?? "The change could not be made.")
      setState("confirmed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change could not be made.")
      setState("open")
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-neutral-200 p-3">
      <div className="text-[10px] uppercase tracking-[0.06em] text-neutral-500">Needs your confirm · stage change</div>
      <div className="text-sm">{proposal.label}</div>
      {state === "open" || state === "working" ? (
        <>
          <div className="text-xs text-neutral-500">{STAGE_NOTE[proposal.to] ?? "Nothing changes until you confirm."}</div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={state === "working"} onClick={() => setState("cancelled")} className="min-h-9 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-[13px] hover:bg-neutral-50 disabled:opacity-40">
              Cancel
            </button>
            <button type="button" disabled={state === "working"} onClick={() => void confirm()} className="min-h-9 rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] text-white disabled:opacity-60">
              {state === "working" ? "Confirming…" : "Confirm"}
            </button>
          </div>
          <div className="font-mono text-[10px] text-neutral-400" title="Your Confirm is bound to this hash of the record as shown">{proposal.hash.slice(0, 16)}</div>
        </>
      ) : (
        <div className="text-xs text-neutral-500">{state === "confirmed" ? "Confirmed. The change is made and logged." : "Cancelled. Nothing changed."}</div>
      )}
    </div>
  )
}

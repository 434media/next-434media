"use client"

// An arrival's agent draft, inside the People Inbox (one work area, founder 2026-11-16; Display Standard §3.14 and
// §3.15, Provisional). The arrival's facts and message, the reply exactly as it will be sent with its hash, Edit, a
// reason and the founder's words, Reject (asks to confirm) and Approve and send (primary). Founder only: the routes it
// calls run the founder guard on the server. An edit is saved through PATCH /api/admin/review/[id], which re-hashes the
// draft; the approval then binds the new hash. Nothing sends unless he presses Approve and send, and every control in
// lib/agent/send-email.ts still applies.

import { useEffect, useState } from "react"
import { AlertTriangle, Pencil } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { ReviewItem } from "@/lib/agent/review"

/** One draft as "Waiting on you" reads it (lib/agent/review-server.ts WaitingItem). */
export type DraftItem = ReviewItem & {
  arrival?: { name: string; email?: string; company?: string; body?: string; occurredAt: string; triaged: boolean; fit?: { grade?: string; score?: number } }
}

export const OUTCOME_LABEL: Record<string, string> = {
  qualified: "Qualified",
  clarify: "Clarify",
  discovery: "Discovery",
  flag: "Flag to you",
  decline: "Decline",
  "route-ntooitive": "Route to Ntooitive",
  "ampd-intake": "AMPD intake",
}

export const STATUS_LABEL: Record<string, string> = {
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

// The reason codes are lib/agent/review.ts REASON_CODES; the select groups them by what the decision is, so the reason
// picked says which button applies. Values carry the decision because "other" is in both.
const REASONS = {
  approved: [
    { code: "as-drafted", label: "Right as drafted" },
    { code: "edited", label: "Edited, then approved" },
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
type Decision = keyof typeof REASONS

export const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—")

export function Pill({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "dark" | "amber" | "red" | "green"; title?: string }) {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-0.5 text-sm text-neutral-800">{children || "—"}</div>
    </div>
  )
}

export type DraftOutcome = { type: "success" | "error"; message: string; changed: boolean }

async function call(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

export function DraftDrawer({ item, onClose, onDone, onEdited }: { item: DraftItem | null; onClose: () => void; onDone: (o: DraftOutcome) => void; onEdited: (i: DraftItem) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const [choice, setChoice] = useState<`${Decision}:${string}`>("approved:as-drafted")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecord, setShowRecord] = useState(false)

  // A new draft opened: start clean. An edited one defaults to "Edited, then approved".
  useEffect(() => {
    setEditing(false)
    setText(item?.text ?? "")
    setChoice(item && item.edits > 0 ? "approved:edited" : "approved:as-drafted")
    setReason("")
    setError(null)
    setShowRecord(false)
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <DetailDrawer open={false} onClose={onClose} title="">{null}</DetailDrawer>
  const pending = item.status === "pending" && !item.taskCancelled
  const [decision, code] = choice.split(":") as [Decision, string]
  const ready = pending && !busy && !editing && reason.trim().length > 0

  async function saveEdit() {
    if (!item) return
    setBusy(true)
    setError(null)
    try {
      const r = await call(`/api/admin/review/${encodeURIComponent(item.id)}`, "PATCH", { shownHash: item.hash, text })
      if (!r.ok) throw new Error(String(r.body.error ?? "The edit was not saved"))
      const next = r.body.item as ReviewItem
      setEditing(false)
      setChoice("approved:edited")
      onEdited({ ...item, ...next, arrival: item.arrival })
    } catch (e) {
      setError(e instanceof Error ? e.message : "The edit was not saved")
    } finally {
      setBusy(false)
    }
  }

  async function decideNow(d: Decision) {
    if (!item) return
    if (d === "rejected" && !window.confirm("Reject this draft? It will never be sent; a new draft is needed to reply.")) return
    setBusy(true)
    setError(null)
    try {
      const r = await call(`/api/admin/review/${encodeURIComponent(item.id)}`, "POST", { decision: d, shownHash: item.hash, reasonCode: code, reason, send: d === "approved" })
      const sent = r.body.sent as { sent?: boolean; reason?: string; code?: string } | undefined
      const closed = r.body.closed as { closed?: boolean; reason?: string } | undefined
      if (!r.ok && !r.body.decided) {
        setError(String(r.body.error ?? "The decision was not recorded"))
        return
      }
      if (d === "rejected") onDone({ type: "success", message: "Rejected. Your reason is recorded; the arrival stays in the inbox.", changed: true })
      else if (sent?.sent)
        onDone({
          type: closed?.closed === false ? "error" : "success",
          message: closed?.closed === false ? `Sent and kept on the CRM, but the arrival is still in the inbox: ${closed.reason}` : "Approved and sent. The reply is on the person's record and the arrival left the inbox.",
          changed: true,
        })
      else if (sent) onDone({ type: "error", message: `Approved, not sent: ${sent.reason ?? sent.code}`, changed: true })
      else onDone({ type: "success", message: "Approved.", changed: true })
    } finally {
      setBusy(false)
    }
  }

  const a = item.arrival
  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={a?.name || item.to.join(", ")}
      subtitle={`Draft reply · ${item.subject}`}
      badge={<Pill tone={pending ? "dark" : "neutral"}>{pending ? "Draft ready" : STATUS_LABEL[item.status] ?? item.status}</Pill>}
      width="lg"
      closeOnEscape={!editing}
      closeOnOverlayClick={!editing}
      footer={
        pending ? (
          <div className="flex flex-col gap-2">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={choice} onChange={(e) => setChoice(e.target.value as typeof choice)} aria-label="Reason" className="rounded-lg border border-neutral-200 bg-white px-2 py-2 text-sm sm:w-60">
                <optgroup label="Approve because">
                  {REASONS.approved.map((r) => (
                    <option key={r.code} value={`approved:${r.code}`}>{r.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Reject because">
                  {REASONS.rejected.map((r) => (
                    <option key={r.code} value={`rejected:${r.code}`}>{r.label}</option>
                  ))}
                </optgroup>
              </select>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} placeholder="Why, in a sentence (required, recorded)" aria-label="Your reason" className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-neutral-500">{editing ? "Save or cancel the edit first." : decision === "approved" ? "Sends to the address above once you approve." : "A rejected draft never sends."}</span>
              <button
                disabled={!ready || decision !== "rejected"}
                title={decision !== "rejected" ? "Pick a reason under “Reject because” to reject" : undefined}
                onClick={() => void decideNow("rejected")}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-40"
              >
                Reject
              </button>
              <button
                disabled={!ready || decision !== "approved"}
                title={decision !== "approved" ? "Pick a reason under “Approve because” to approve" : undefined}
                onClick={() => void decideNow("approved")}
                className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                Approve and send
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrived">{when(item.receivedAt ?? a?.occurredAt)}</Field>
          <Field label="Routing">{item.outcome ? OUTCOME_LABEL[item.outcome] ?? item.outcome : null}</Field>
          <Field label="Next owner">{item.handoff?.nextOwner}</Field>
          <Field label="Due">{item.handoff?.due}</Field>
          <Field label="Fit">{a?.fit?.grade ? <span><span className="font-mono font-semibold">{a.fit.grade}</span> <span className="text-neutral-400">{a.fit.score}</span></span> : null}</Field>
          <Field label="Company">{a?.company}</Field>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Why this is here</div>
          <p className="mt-0.5 text-sm text-neutral-800">{item.reviewReason}</p>
        </div>
        {item.flag && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {item.flag}
          </p>
        )}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Their message</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{a?.body || "—"}</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">The reply, exactly as it will be sent</div>
            {pending && !editing && (
              <button onClick={() => { setText(item.text); setEditing(true) }} className="ml-auto inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-3">
            <div className="text-xs text-neutral-500">To {item.to.join(", ")}{item.replyTo ? ` · reply-to ${item.replyTo}` : ""}</div>
            <div className="mt-1 text-sm font-medium text-neutral-900">{item.subject}</div>
            {editing ? (
              <>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} maxLength={8000} aria-label="Reply text" className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-300" />
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setEditing(false)} disabled={busy} className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100">Cancel</button>
                  <button onClick={() => void saveEdit()} disabled={busy || !text.trim() || text === item.text} className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40">Save edit</button>
                </div>
              </>
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{item.text}</p>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] text-neutral-400">
            hash {item.hash.slice(0, 12)}{item.edits > 0 ? ` · edited ${item.edits === 1 ? "once" : `${item.edits} times`}; your approval binds this text` : ""}
          </p>
        </div>
        {item.handoff?.returnCondition && <Field label="Back to a person if">{item.handoff.returnCondition}</Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Approval expires">{when(item.expiresAt)}</Field>
          <Field label="Model">{item.model ? <span className="font-mono text-xs">{item.model.replace("anthropic/", "")}</span> : null}</Field>
        </div>
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

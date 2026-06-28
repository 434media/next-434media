"use client"

import { useState } from "react"
import { Loader2, Mail, Pause, Play, Square, Send, ListChecks, CheckCircle2 } from "lucide-react"
import type { Lead } from "@/types/crm-types"

export type SequenceStepDraft = { n: 1 | 2 | 3; subject: string; body: string }
export type SequenceAction = "draft" | "enroll" | "pause" | "resume" | "stop"

export interface SequenceActionResult {
  ok: boolean
  steps?: SequenceStepDraft[]
  lead?: Lead
}

interface Props {
  lead: Lead
  isEditing: boolean
  onSequenceAction: (
    id: string,
    action: SequenceAction,
    steps?: SequenceStepDraft[],
  ) => Promise<SequenceActionResult>
}

const STEP_LABEL: Record<1 | 2 | 3, string> = { 1: "intro", 2: "value", 3: "final follow-up" }

function fmt(iso?: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// 3-email outreach sequence — set up (rep confirms 3 AI drafts) → enroll → the
// cron auto-sends on the 0/+4/+5 business-day cadence. See docs/outreach-sequence.md.
export function OutreachSequencePanel({ lead, isEditing, onSequenceAction }: Props) {
  const seq = lead.outreach_sequence
  const [drafts, setDrafts] = useState<SequenceStepDraft[] | null>(null)
  const [busy, setBusy] = useState<SequenceAction | null>(null)

  if (!isEditing) return null // sequences are only available on saved leads

  const isActive = seq && (seq.status === "active" || seq.status === "paused")
  const blocked = lead.status === "converted" || lead.status === "archived"

  const setup = async () => {
    setBusy("draft")
    const r = await onSequenceAction(lead.id, "draft")
    setBusy(null)
    if (r.ok && r.steps) setDrafts(r.steps)
  }
  const enroll = async () => {
    if (!drafts) return
    setBusy("enroll")
    const r = await onSequenceAction(lead.id, "enroll", drafts)
    setBusy(null)
    if (r.ok) setDrafts(null)
  }
  const manage = async (action: SequenceAction) => {
    setBusy(action)
    await onSequenceAction(lead.id, action)
    setBusy(null)
  }
  const editDraft = (i: number, field: "subject" | "body", value: string) =>
    setDrafts((prev) => (prev ? prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)) : prev))

  // ── Active / paused sequence → status view ──
  if (isActive && seq) {
    const tint =
      seq.status === "active"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700"
    return (
      <div className="mt-3 rounded-md border border-neutral-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-700">
            <Mail className="w-3.5 h-3.5" /> 3-email sequence
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tint}`}>{seq.status}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {seq.status === "active" ? (
              <button type="button" onClick={() => manage("pause")} disabled={!!busy} className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-neutral-600 hover:text-neutral-900 disabled:opacity-50">
                {busy === "pause" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />} Pause
              </button>
            ) : (
              <button type="button" onClick={() => manage("resume")} disabled={!!busy} className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-neutral-600 hover:text-neutral-900 disabled:opacity-50">
                {busy === "resume" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Resume
              </button>
            )}
            <button type="button" onClick={() => manage("stop")} disabled={!!busy} className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-red-600 hover:text-red-700 disabled:opacity-50">
              {busy === "stop" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />} Stop
            </button>
          </div>
        </div>
        <p className="text-[11px] text-neutral-500 mt-1">
          {seq.next_step
            ? `Next: email ${seq.next_step} of 3 on ${fmt(seq.next_send_at)}`
            : "All steps scheduled"}
        </p>
        <ol className="mt-2 space-y-1">
          {seq.steps.map((s) => (
            <li key={s.n} className="flex items-center gap-2 text-[11px]">
              <span
                className={`grid place-items-center w-4 h-4 rounded-full text-[9px] font-bold ${
                  s.sent_at ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {s.n}
              </span>
              <span className="flex-1 truncate text-neutral-700">{s.subject}</span>
              <span className="text-neutral-400">{s.sent_at ? `sent ${fmt(s.sent_at)}` : "queued"}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // ── Reviewing drafts → edit + enroll ──
  if (drafts) {
    return (
      <div className="mt-3 space-y-2.5">
        <p className="text-[11px] text-neutral-500">
          Review the 3 emails — they send on a 0 / +4 / +5 business-day cadence after you enroll. Edit anything before
          sending. Stops automatically on reply (mark the lead engaged), opt-out, or convert.
        </p>
        {drafts.map((d, i) => (
          <div key={d.n} className="rounded-md border border-neutral-200 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
              Email {d.n} · {STEP_LABEL[d.n]}
            </div>
            <input
              type="text"
              value={d.subject}
              onChange={(e) => editDraft(i, "subject", e.target.value)}
              placeholder="Subject"
              className="w-full px-2 py-1 mb-1.5 text-[12px] border border-neutral-200 rounded focus:outline-none focus:border-neutral-400"
            />
            <textarea
              value={d.body}
              onChange={(e) => editDraft(i, "body", e.target.value)}
              rows={5}
              className="w-full px-2 py-1.5 text-[12px] border border-neutral-200 rounded focus:outline-none focus:border-neutral-400 font-mono leading-relaxed"
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={enroll}
            disabled={busy === "enroll"}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-[12px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50"
          >
            {busy === "enroll" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enroll &amp; send email 1
          </button>
          <button
            type="button"
            onClick={() => setDrafts(null)}
            disabled={busy === "enroll"}
            className="px-3 py-1.5 text-[12px] text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── No active sequence → set up ──
  return (
    <div className="mt-3">
      {seq && (seq.status === "completed" || seq.status === "stopped") && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
          Previous sequence {seq.status}
          {seq.stopped_reason ? ` (${seq.stopped_reason})` : ""}.
        </p>
      )}
      <button
        type="button"
        onClick={setup}
        disabled={!!busy || blocked}
        title={blocked ? `Can't sequence a ${lead.status} lead` : "Draft a 3-email sequence"}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-50"
      >
        {busy === "draft" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
        Set up 3-email sequence
      </button>
      <p className="mt-1 text-[10px] text-neutral-400">
        AI drafts intro → value → final follow-up; you review and confirm before anything sends.
      </p>
    </div>
  )
}

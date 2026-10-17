"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Newspaper, X, Loader2, ArrowUpRight } from "lucide-react"

// The board's Generate control (content pipeline, lib/content-pipeline/): starts a MilCityUSA batch by series and
// count, then shows where each draft stands. Drafts land in the Review column as content posts with their rendered
// Canva card; nothing here approves or publishes. Super-admin only (the API enforces it).

const SERIES = [
  { value: "news", label: "News" },
  { value: "breaking", label: "Breaking" },
  { value: "dt101", label: "DT101" },
  { value: "icymi", label: "ICYMI" },
] as const
type Kind = typeof SERIES[number]["value"]

interface DraftView { id: string; status: string; title: string; holdReason: string | null; error: string | null; postId: string | null; checks: number }
interface JobView { id: string; kind: Kind; count: number; topic: string | null; status: string; note: string | null; createdAt: string; drafts: DraftView[] }
interface RunsResponse { seeds: { loaded: boolean; snapshot?: string }; jobs: JobView[] }

const STATUS_LABEL: Record<string, string> = {
  researching: "Researching", drafting: "Drafting", done: "Done", held: "Held", failed: "Failed",
  queued: "Queued", writing: "Writing", media: "Finding a photo", designing: "Filling Canva", reviewing: "Checking artwork", posting: "Adding to board", in_review: "In Review",
}
const SETTLED = new Set(["done", "held", "failed", "in_review"])
const kindLabel = (k: string) => SERIES.find(s => s.value === k)?.label ?? k

export function ContentGenerate({ onDraftsReady }: { onDraftsReady?: () => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>("dt101")
  const [count, setCount] = useState(1)
  const [topic, setTopic] = useState("")
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<RunsResponse | null>(null)
  const ready = useRef<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/content-pipeline/jobs", { cache: "no-store" })
      if (!r.ok) return
      const data = (await r.json()) as RunsResponse
      setRuns(data)
      // Re-sync the board when a draft reaches Review.
      const now = data.jobs.flatMap(j => j.drafts).filter(d => d.status === "in_review").map(d => d.id)
      if (now.some(id => !ready.current.has(id))) { if (ready.current.size) onDraftsReady?.(); now.forEach(id => ready.current.add(id)) }
    } catch { /* non-fatal */ }
  }, [onDraftsReady])

  const active = !!runs?.jobs.some(j => !SETTLED.has(j.status) || j.drafts.some(d => !SETTLED.has(d.status)))
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!open && !active) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [open, active, load])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
  }, [open])

  const start = async () => {
    setStarting(true); setError(null)
    try {
      const r = await fetch("/api/admin/content-pipeline/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID().replace(/-/g, ""), kind, count: kind === "icymi" ? 1 : count, ...(topic.trim() ? { topic: topic.trim() } : {}) }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setError(data.error || "Could not start the run"); return }
      setTopic("")
      await load()
    } catch {
      setError("Could not start the run")
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 transition-colors text-sm font-medium"
      >
        {active ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
        Generate
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-lg bg-white shadow-lg ring-1 ring-neutral-200 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Generate MilCityUSA drafts</p>
              <p className="text-xs text-neutral-500 mt-0.5">Researched, written, filled in Canva and checked. Drafts arrive in Review; nothing is published.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded text-neutral-400 hover:text-neutral-700"><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-3">
            <div className="inline-flex w-full rounded-md ring-1 ring-neutral-200 overflow-hidden divide-x divide-neutral-200" role="radiogroup" aria-label="Series">
              {SERIES.map(s => (
                <button key={s.value} type="button" role="radio" aria-checked={kind === s.value} onClick={() => setKind(s.value)}
                  className={`flex-1 h-8 text-xs font-medium transition-colors ${kind === s.value ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-neutral-600" htmlFor="gen-count">Posts</label>
              {kind === "icymi" ? (
                <span className="text-xs text-neutral-500">One roundup of five published stories</span>
              ) : (
                <select id="gen-count" value={count} onChange={e => setCount(Number(e.target.value))} className="h-8 rounded-md ring-1 ring-neutral-200 bg-white px-2 text-sm">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
            {kind !== "icymi" && (
              <input value={topic} onChange={e => setTopic(e.target.value)} maxLength={300} placeholder="Topic or angle (optional)"
                className="w-full h-8 rounded-md ring-1 ring-neutral-200 px-2.5 text-sm placeholder:text-neutral-400" />
            )}
            {runs && !runs.seeds.loaded && (
              <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-2 py-1.5">Source seeds aren&apos;t loaded, so research runs on the editorial rules alone.</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="button" onClick={start} disabled={starting}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-50">
              {starting && <Loader2 className="w-4 h-4 animate-spin" />}
              Start {kindLabel(kind)}{kind !== "icymi" && count > 1 ? ` × ${count}` : ""}
            </button>
          </div>

          {!!runs?.jobs.length && (
            <div className="border-t border-neutral-100 pt-3 space-y-3 max-h-72 overflow-y-auto">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Recent runs</p>
              {runs.jobs.map(j => (
                <div key={j.id} className="space-y-1">
                  <p className="text-xs text-neutral-700">
                    <span className="font-medium">{kindLabel(j.kind)}{j.count > 1 ? ` × ${j.count}` : ""}</span>
                    <span className="text-neutral-400"> · {STATUS_LABEL[j.status] ?? j.status} · {new Date(j.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </p>
                  {j.note && <p className="text-[11px] text-neutral-500">{j.note}</p>}
                  {j.drafts.map(d => (
                    <div key={d.id} className="flex items-start justify-between gap-2 text-[11px] pl-2 border-l border-neutral-200">
                      <div className="min-w-0">
                        <p className="truncate text-neutral-800">{d.title}</p>
                        <p className={d.status === "held" || d.status === "failed" ? "text-amber-700" : "text-neutral-500"}>
                          {d.id} · {STATUS_LABEL[d.status] ?? d.status}{d.status === "in_review" && d.checks ? ` · ${d.checks} to check` : ""}
                          {d.holdReason ? ` — ${d.holdReason}` : d.error ? ` — ${d.error}` : ""}
                        </p>
                      </div>
                      {d.postId && (
                        <Link href={`/admin/content?openContent=${encodeURIComponent(d.postId)}`} onClick={() => setOpen(false)}
                          className="shrink-0 inline-flex items-center gap-0.5 font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2">
                          Open <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

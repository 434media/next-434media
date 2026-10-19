"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Newspaper, X, Loader2, ArrowUpRight } from "lucide-react"
import { DEFAULT_PROPERTY, PIPELINE_PROPERTIES, type PipelineTemplate } from "@/lib/content-pipeline/properties"
import type { RequestKind } from "@/lib/content-pipeline/series"

// The board's Generate control (content pipeline, lib/content-pipeline/): choose a property, then one of its
// templates, then an optional instruction, and start a batch; then see where each draft stands. A brand's templates
// come from its published brand profile, read from the database (GET /api/admin/brand-profiles); only MilCityUSA has
// one (founder, 2026-10-17), and a brand without a valid published profile is not offered. Drafts land in the Review column as content posts with their rendered
// Canva card; nothing here approves or publishes. Super-admin only (the API enforces it).

type Kind = RequestKind

interface DraftView { id: string; status: string; title: string; holdReason: string | null; error: string | null; postId: string | null; checks: number }
interface JobView { id: string; property: string; noContentPostId: string | null; closedAt: string | null; kind: Kind; count: number; topic: string | null; status: string; note: string | null; createdAt: string; drafts: DraftView[] }
interface RunsResponse { seeds: { loaded: boolean; snapshot?: string }; jobs: JobView[] }

const STATUS_LABEL: Record<string, string> = {
  researching: "Researching", drafting: "Drafting", done: "Done", held: "Held", failed: "Failed",
  choosing: "Waiting for your choice", queued: "Queued", writing: "Writing", media: "Finding a photo", designing: "Filling Canva", reviewing: "Checking artwork", posting: "Adding to board", in_review: "In Review",
}
const SETTLED = new Set(["done", "held", "failed", "in_review", "choosing"])
interface BrandView { id: string; label: string; active: boolean; versionId: string | null; templates: PipelineTemplate[]; reason: string | null }
const kindLabel = (brands: BrandView[], k: string, property = DEFAULT_PROPERTY) => brands.find(b => b.id === property)?.templates.find(t => t.kind === k)?.label ?? k
const propertyLabel = (id: string) => PIPELINE_PROPERTIES.find(p => p.id === id)?.label ?? id

interface RoundupView { postId: string; title: string; publishedAt?: string; card?: { url: string } }
interface ChoiceDraft { id: string; status: string; story: { roundup?: RoundupView[] }; choice?: { min: number; max: number } }

// An ICYMI draft waiting for the requester's choice (more published stories qualified than a roundup takes): pick
// min–max of them. Functional only; its look waits for the Phase 3b polish pass. Linked from the Slack alert, the
// admin notification and the CRM task as /admin/content?icymiDraft=<id>.
function RoundupPicker({ draftId, onDone }: { draftId: string; onDone: () => void }) {
  const [draft, setDraft] = useState<ChoiceDraft | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let live = true
    fetch(`/api/admin/content-pipeline/drafts/${encodeURIComponent(draftId)}`, { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!live) return; if (r.ok) setDraft(data.draft); else setError(data.error || "Could not read the draft") })
      .catch(() => live && setError("Could not read the draft"))
    return () => { live = false }
  }, [draftId])
  if (error && !draft) return <p className="text-xs text-red-600">{error}</p>
  if (!draft) return <p className="text-xs text-neutral-500">Loading {draftId}…</p>
  if (draft.status !== "choosing") return <p className="text-xs text-neutral-500">{draftId}: the stories are already chosen.</p>
  const { min, max } = draft.choice ?? { min: 3, max: 5 }, items = draft.story.roundup ?? []
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const submit = async (close = false) => {
    setSaving(true); setError(null)
    try {
      const r = await fetch(`/api/admin/content-pipeline/drafts/${encodeURIComponent(draftId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(close ? { close: true } : { postIds: items.filter(p => picked.includes(p.postId)).map(p => p.postId) }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { setError(data.error || "Could not record the choice"); return }
      onDone()
    } catch { setError("Could not record the choice") } finally { setSaving(false) }
  }
  return (
    <div className="space-y-2 rounded-md ring-1 ring-amber-200 bg-amber-50 p-2.5">
      <p className="text-xs font-medium text-neutral-900">{draftId}: choose {min}–{max} stories for the ICYMI roundup</p>
      <div className="space-y-1">
        {items.map(p => (
          <label key={p.postId} className="flex items-center gap-2 text-[11px] text-neutral-800 cursor-pointer">
            <input type="checkbox" checked={picked.includes(p.postId)} onChange={() => toggle(p.postId)} />
            {/* eslint-disable-next-line @next/next/no-img-element -- the post's own staged card, shown as it was posted */}
            {p.card && <img src={p.card.url} alt="" className="w-8 h-10 object-cover rounded-sm shrink-0" />}
            <span className="min-w-0 truncate">{p.title}{p.publishedAt ? ` · ${p.publishedAt.slice(0, 10)}` : ""}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="button" onClick={() => submit()} disabled={saving || picked.length < min || picked.length > max}
        className="w-full h-8 rounded-md bg-neutral-900 text-white text-xs font-medium disabled:opacity-50">
        Use {picked.length} {picked.length === 1 ? "story" : "stories"}
      </button>
      <button type="button" onClick={() => submit(true)} disabled={saving} className="w-full text-[11px] text-neutral-500 hover:text-neutral-800 hover:underline underline-offset-2">
        Close without a roundup
      </button>
    </div>
  )
}

export function ContentGenerate({ onDraftsReady }: { onDraftsReady?: () => void }) {
  const linked = useSearchParams()?.get("icymiDraft") ?? null
  const [choosing, setChoosing] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [property, setProperty] = useState(DEFAULT_PROPERTY)
  const [kind, setKind] = useState<Kind>("dt101")
  const [count, setCount] = useState(1)
  const [topic, setTopic] = useState("")
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<RunsResponse | null>(null)
  const [brands, setBrands] = useState<BrandView[]>([])
  const [brandsError, setBrandsError] = useState<string | null>(null)
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
  // The brands and their templates, from the published profiles, each time the panel opens (a Publish shows at once).
  useEffect(() => {
    if (!open) return
    setBrandsError(null)
    void fetch("/api/admin/brand-profiles", { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})) as { brands?: BrandView[]; error?: string }; if (!r.ok || !d.brands) throw new Error(d.error || "Could not read the brand profiles"); setBrands(d.brands) })
      .catch((e: unknown) => setBrandsError(e instanceof Error ? e.message : "Could not read the brand profiles"))
  }, [open])
  // Opened from the choice alert: show the picker for that draft.
  useEffect(() => { if (linked && /^[A-Z0-9-]{10,40}$/.test(linked)) { setChoosing(linked); setOpen(true) } }, [linked])
  useEffect(() => {
    if (!open && !active) return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [open, active, load])
  // While this panel is open on an unfinished run, ask the server to resume due work: now, then about once a minute.
  // Previews have no cron, and a failed step waits a minute before its retry. Only an open panel resumes work, so
  // loading the board never restarts a run by itself; leases keep this apart from the production cron.
  useEffect(() => {
    if (!open || !active) return
    const kick = () => { void fetch("/api/admin/content-pipeline/run", { method: "POST" }).catch(() => {}) }
    kick()
    const t = setInterval(kick, 60_000)
    return () => clearInterval(t)
  }, [open, active])
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
        body: JSON.stringify({ requestId: crypto.randomUUID().replace(/-/g, ""), property, kind, count: kind === "icymi" ? 1 : count, ...(topic.trim() ? { topic: topic.trim() } : {}) }),
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
        // Phone: pinned to the viewport with a 16px gutter, full width, scrolling inside. From sm up: a 380px
        // dropdown under the button.
        <div className="fixed inset-x-4 top-4 max-h-[calc(100dvh-2rem)] z-50 overflow-y-auto overscroll-contain rounded-lg bg-white shadow-lg ring-1 ring-neutral-200 p-4 space-y-4 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:z-30 sm:mt-2 sm:w-[380px] sm:max-h-[80vh]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Generate drafts</p>
              <p className="text-xs text-neutral-500 mt-0.5">Researched, written, filled in Canva and checked. Drafts arrive in Review; nothing is published.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded text-neutral-400 hover:text-neutral-700"><X className="w-4 h-4" /></button>
          </div>

          {choosing && <RoundupPicker key={choosing} draftId={choosing} onDone={() => { setChoosing(null); void load() }} />}

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-700" htmlFor="gen-property">Brand</label>
              {brandsError && <p role="alert" className="text-xs text-red-600">{brandsError}</p>}
              <select id="gen-property" value={property} onChange={e => setProperty(e.target.value)} className="w-full h-8 rounded-md ring-1 ring-neutral-200 bg-white px-2 text-sm">
                {PIPELINE_PROPERTIES.map(p => {
                  const b = brands.find(x => x.id === p.id), offered = !!b?.active
                  return <option key={p.id} value={p.id} disabled={!offered}>{p.label}{offered ? "" : ` — ${b?.reason ?? (brands.length ? p.reason : brandsError ? "unavailable" : "Loading…")}`}</option>
                })}
              </select>
            </div>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-neutral-700">Template</legend>
              <div className="rounded-md ring-1 ring-neutral-200 divide-y divide-neutral-100" role="radiogroup" aria-label="Template">
                {(brands.find(b => b.id === property && b.active)?.templates ?? []).map(t => (
                  <label key={t.kind} className={`flex items-start gap-2 px-2.5 py-2 cursor-pointer ${kind === t.kind ? "bg-neutral-50" : "hover:bg-neutral-50"}`}>
                    <input type="radio" name="gen-template" value={t.kind} checked={kind === t.kind} onChange={() => setKind(t.kind)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm text-neutral-900">{t.label}</span>
                      <span className="block text-[11px] text-neutral-500">{t.detail} · Canva {t.templates.join(" + ")}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-neutral-700" htmlFor="gen-count">Posts</label>
              {kind === "icymi" ? (
                <span className="text-xs text-neutral-500">One roundup of 3–5 published stories</span>
              ) : (
                <select id="gen-count" value={count} onChange={e => setCount(Number(e.target.value))} className="h-8 rounded-md ring-1 ring-neutral-200 bg-white px-2 text-sm">
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
            {kind !== "icymi" && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700" htmlFor="gen-instruction">Instruction <span className="font-normal text-neutral-400">(optional)</span></label>
                <textarea id="gen-instruction" value={topic} onChange={e => setTopic(e.target.value)} maxLength={1000} rows={2} placeholder="A subject, company or angle to steer research and writing"
                  className="w-full rounded-md ring-1 ring-neutral-200 px-2.5 py-1.5 text-sm placeholder:text-neutral-400 resize-y" />
              </div>
            )}
            {runs && !runs.seeds.loaded && (
              <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-2 py-1.5">Source seeds aren&apos;t loaded, so research runs on the editorial rules alone.</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="button" onClick={start} disabled={starting || !brands.some(b => b.id === property && b.active)}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-50">
              {starting && <Loader2 className="w-4 h-4 animate-spin" />}
              Start {kindLabel(brands, kind, property)}{kind !== "icymi" && count > 1 ? ` × ${count}` : ""}
            </button>
          </div>

          {!!runs?.jobs.length && (
            <div className="border-t border-neutral-100 pt-3 space-y-3 sm:max-h-72 sm:overflow-y-auto">
              <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Recent runs</p>
              {runs.jobs.map(j => (
                <div key={j.id} className="space-y-1">
                  <p className="text-xs text-neutral-700">
                    <span className="font-medium">{propertyLabel(j.property)} · {kindLabel(brands, j.kind, j.property)}{j.count > 1 ? ` × ${j.count}` : ""}</span>
                    <span className="text-neutral-400"> · {STATUS_LABEL[j.status] ?? j.status} · {new Date(j.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </p>
                  {j.note && <p className="text-[11px] text-neutral-500">{j.note}</p>}
                  {j.noContentPostId && (
                    <p className="text-[11px] text-neutral-500">
                      No new content{j.closedAt ? " · closed" : ""} ·{" "}
                      <Link href={`/admin/content?openContent=${encodeURIComponent(j.noContentPostId)}`} onClick={() => setOpen(false)} className="font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2">Open card</Link>
                    </p>
                  )}
                  {j.drafts.map(d => (
                    <div key={d.id} className="flex items-start justify-between gap-2 text-[11px] pl-2 border-l border-neutral-200">
                      <div className="min-w-0">
                        <p className="truncate text-neutral-800">{d.title}</p>
                        <p className={d.status === "held" || d.status === "failed" ? "text-amber-700" : "text-neutral-500"}>
                          {d.id} · {STATUS_LABEL[d.status] ?? d.status}{d.status === "in_review" && d.checks ? ` · ${d.checks} to check` : ""}
                          {d.holdReason ? ` — ${d.holdReason}` : d.error ? (d.status === "failed" ? ` — ${d.error}` : ` — retrying after: ${d.error}`) : ""}
                        </p>
                      </div>
                      {d.status === "choosing" && (
                        <button type="button" onClick={() => setChoosing(d.id)} className="shrink-0 font-medium text-neutral-700 hover:text-neutral-900 hover:underline underline-offset-2">Choose stories</button>
                      )}
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

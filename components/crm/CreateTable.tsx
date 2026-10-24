"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Loader2, PenLine, Play, Plus, Trash2, Upload, X, ArrowUpRight } from "lucide-react"
import { CREATE_ROWS_STORE_KEY, CREATE_SOCIALS, FORMAT_LABEL, SOCIAL_LABEL, choiceLabel, formatChoices, formatsOf, mediaShapeOf, normalizePlatforms, pickedFormat, platformIdOf, rowProblems, templateGap, type CellField, type CreateFormat, type CreatePlatform, type CreateRow, type CreateSocial, type CreateTemplate, type MediaShape } from "@/lib/content-pipeline/create-table"
import { HelpTip } from "@/components/admin/HelpTip"
import { isCanvaLink, mediaFromCanva, mediaFromFile, mediaFromLink, type MediaResult } from "./row-media"

/**
 * The Create table (plan v11 Step 2): one global Create button opens one table, five rows by default. Each row is one
 * post: Brand, Template (from the brand's published profile), Reference link, Media, Target platforms, Headline,
 * Sub-headline, Caption, Date, and optional starter notes. Human+ drafts a row's cells from its reference link; the
 * person edits them; Run job fills every Canva template the row's platforms need and lands the designs in Review.
 * Rows are kept in this browser (localStorage) until they run, so a reload loses nothing.
 *
 * Step 3 part 2: choosing a Brand lists its templates in the row; ticking more than one expands the row into one row
 * per template (each a post of its own), copied from the row with the fields the template doesn't use left out.
 *
 * Step 3 part 4: the Media cell also takes a Canva design link, which the app exports (MP4 or JPG); (?) tips explain
 * the columns.
 *
 * Step 3 part 5: one size per platform per row. Each platform is ticked once; its size follows the row's media (a photo
 * goes to Instagram and Facebook at 4:5; a video as a 9:16 Reel, or at 4:5), and a (?) tip explains each choice.
 */
interface BrandConfig { id: string; label: string; active: boolean; reason: string | null; versionId: string | null; templates: CreateTemplate[] }
interface Config { brands: BrandConfig[]; platforms: CreatePlatform[] }
interface RunPost { format: "feed" | "reels"; postId: string; designId: string; editUrl: string; previewUrl?: string; holds: string[] }
interface RowState { busy?: "human" | "media" | "run"; message?: string; error?: string; notes?: string[]; hold?: string; posts?: RunPost[]; done?: boolean }

const STORE_KEY = CREATE_ROWS_STORE_KEY
const DEFAULT_PLATFORMS = ["instagram_feed", "facebook_feed"]
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const newId = () => `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const blankRow = (brand = "", kind = ""): CreateRow => ({ id: newId(), brand, kind, referenceLink: "", notes: "", media: null, platforms: DEFAULT_PLATFORMS, headline: "", subHeadline: "", caption: "", date: today(), fields: {} })
function loadRows(): CreateRow[] | null {
  try { const raw = localStorage.getItem(STORE_KEY); const rows = raw ? JSON.parse(raw) as CreateRow[] : null; return Array.isArray(rows) && rows.length ? rows : null } catch { return null }
}
function saveRows(rows: CreateRow[]) { try { localStorage.setItem(STORE_KEY, JSON.stringify(rows)) } catch { /* private window: rows live for this visit */ } }

/** One or two plain lines per column, behind its (?) tip. */
const COLUMN_HELP: Record<string, string> = {
  Template: "The card design. Tick a second template to add a row for it; each row is its own post.",
  "Reference link": "The story this post is about. Human+ reads it and drafts the Headline, Sub-headline and Caption.",
  Media: "The photo or video for the card's frame. Drop a file, paste a link to the file, or paste a Canva design link and the app exports it.",
  "Target platforms": "Where the post goes, one size per platform. The size follows the media: a photo or a video.",
  Caption: "The text under the post. It never changes the design.",
  Date: "The day the post goes out. The card's own printed date comes from the story, when Human+ finds one.",
}

/** The (?) tip beside a platform's size: why it gets that size, and the alternative when there is one. */
function choiceHelp(platform: CreateSocial, format: CreateFormat, shape: MediaShape): string {
  if (platform === "tiktok" || platform === "youtube") return `${SOCIAL_LABEL[platform]} takes the 9:16 design only. It is posted by hand for now.`
  if (platform === "linkedin") return "LinkedIn gets the 4:5 design. It is posted by hand for now."
  if (shape === "photo") return `A photo goes to ${SOCIAL_LABEL[platform]} as a 4:5 post, the size the feed shows in full.`
  if (platform === "facebook") return format === "reels"
    ? "A video goes to Facebook as a full-screen 9:16 Reel. Pick 4:5 video to post it at 4:5 instead."
    : "Facebook posts the 4:5 video as a regular video on the Page, not as a Reel. Pick 9:16 Reel for a Reel."
  return format === "reels"
    ? "A video goes to Instagram as a full-screen 9:16 Reel. Pick 4:5 Reel for a Reel that also shows on the grid."
    : "The video goes to Instagram as a 4:5 Reel that also shows on the grid. Pick 9:16 Reel for full screen."
}

/** "12 / 15" per line for a field with limits, red when over. */
function limitNote(f: CellField | undefined, value: string): { text: string; over: boolean } | null {
  if (!f) return null
  if (f.maxChars) return { text: `${value.length}/${f.maxChars}`, over: value.length > f.maxChars }
  if (f.perLine) {
    const lines = value.split("\n"), longest = Math.max(0, ...lines.map(l => l.length))
    const cap = f.exactLines ? `${f.exactLines} lines × ${f.perLine}` : f.maxLines ? `${f.maxLines} lines × ${f.perLine}` : `${f.perLine}/line`
    return { text: `${longest}/${f.perLine} · ${cap}`, over: f.exactLines ? longest > f.perLine : !!f.maxLines && value.length > f.perLine * f.maxLines }
  }
  return null
}

export function CreateTable({ onPostsReady }: { onPostsReady?: () => void }) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [rows, setRows] = useState<CreateRow[]>([])
  const [state, setState] = useState<Record<string, RowState>>({})
  const [running, setRunning] = useState(false)
  const loaded = useRef(false)

  const loadConfig = useCallback(async () => {
    setConfigError(null)
    try {
      const res = await fetch("/api/admin/content/create-config", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load the brands")
      setConfig(data as Config)
      return data as Config
    } catch (e) { setConfigError(e instanceof Error ? e.message : "Could not load the brands"); return null }
  }, [])

  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    loadConfig().then(c => {
      const first = c?.brands.find(b => b.active), kind = first?.templates[0]?.kind ?? ""
      // A row kept from before part 5 may tick a platform at two sizes; it keeps one, at a size its media allows.
      const kept = loadRows()?.map(r => ({ ...r, platforms: normalizePlatforms(r.platforms, mediaShapeOf(r.media)) }))
      setRows(kept ?? Array.from({ length: 5 }, () => blankRow(first?.id ?? "", kind)))
    })
  }, [open, loadConfig])
  useEffect(() => { if (loaded.current && rows.length) saveRows(rows) }, [rows])

  const brandOf = (r: CreateRow) => config?.brands.find(b => b.id === r.brand)
  const templateOf = (r: CreateRow) => brandOf(r)?.templates.find(t => t.kind === r.kind)
  // A new Brand or Template refits the platforms to the sizes its template has.
  const patch = (id: string, p: Partial<CreateRow>) => setRows(rs => rs.map(r => r.id === id ? ("kind" in p || "brand" in p ? fit({ ...r, ...p }) : { ...r, ...p }) : r))
  /** The row's platforms fitted to its media and template; `fresh` when the media changed between photo and video. */
  const fit = (r: CreateRow, fresh = false): CreateRow => {
    const t = templateOf(r)
    return { ...r, platforms: normalizePlatforms(r.platforms, mediaShapeOf(r.media), f => !t || !!t.templates[f], fresh) }
  }
  const patchState = (id: string, s: RowState | ((cur: RowState) => RowState)) => setState(cur => ({ ...cur, [id]: typeof s === "function" ? s(cur[id] ?? {}) : s }))

  /** Ticking a template: an empty row takes it; a row that has one gets a copy below it for the new template. */
  function pickTemplate(r: CreateRow, kind: string) {
    if (!r.kind) { patch(r.id, { kind }); return }
    const next = brandOf(r)?.templates.find(x => x.kind === kind)
    const fields = Object.fromEntries(Object.entries(r.fields).filter(([k]) => k === "date" || next?.fields.some(f => f.name === k)))
    const has = (f: CreateFormat) => !!next?.templates[f], shape = mediaShapeOf(r.media)
    const platforms = normalizePlatforms(r.platforms, shape, has)
    const copy: CreateRow = { ...r, id: newId(), kind, fields, platforms: platforms.length ? platforms : normalizePlatforms(DEFAULT_PLATFORMS, shape, has) }
    setRows(rs => { const i = rs.findIndex(x => x.id === r.id); return [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)] })
  }

  async function humanPlus(r: CreateRow) {
    if (!r.referenceLink.startsWith("https://")) { patchState(r.id, { error: "Paste an https reference link first" }); return }
    patchState(r.id, { busy: "human", message: "Reading the link and drafting…" })
    try {
      const res = await fetch("/api/admin/content/generate-copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: r.brand, kind: r.kind, referenceLink: r.referenceLink, ...(r.notes.trim() ? { notes: r.notes.trim() } : {}), ...(r.media?.source ? { mediaFrom: r.media.source } : {}) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Human+ failed")
      if (data.hold) { patchState(r.id, { hold: data.hold, message: undefined }); return }
      const t = templateOf(r)
      const extras = Object.fromEntries(Object.entries(data.fields as Record<string, string>).filter(([k]) => t?.fields.some(f => f.role === "extra" && f.name === k) || k === "date"))
      patch(r.id, { headline: data.headline, subHeadline: data.subHeadline, caption: data.caption, fields: { ...r.fields, ...extras }, copyVersionId: data.profileVersionId })
      patchState(r.id, { notes: data.notes, message: `Drafted from ${data.facts} sourced facts (${data.profileVersionId}). Check every cell before Run job.` })
    } catch (e) { patchState(r.id, { error: e instanceof Error ? e.message : "Human+ failed" }) }
  }

  /** Media for a row: a dropped file, a pasted file link, or a Canva design the app exports (row-media.ts). */
  async function takeMedia(r: CreateRow, message: string, get: () => Promise<MediaResult>, failed: string) {
    const before = mediaShapeOf(r.media)
    patch(r.id, { media: null })
    patchState(r.id, { busy: "media", message })
    try {
      const { media, message: done } = await get()
      // A video ticks Instagram and Facebook as a 9:16 Reel by default; a photo at 4:5.
      setRows(rs => rs.map(x => x.id === r.id ? fit({ ...x, media }, mediaShapeOf(media) !== before) : x))
      patchState(r.id, s => ({ ...s, busy: undefined, message: done }))
    } catch (e) { patchState(r.id, { error: e instanceof Error ? e.message : failed }) }
  }
  const dropFile = (r: CreateRow, file: File) => takeMedia(r, `Uploading ${file.name}…`, () => mediaFromFile(file), "Upload failed")
  const pasteMedia = (r: CreateRow, url: string) => url.startsWith("https://") ? takeMedia(r, "Optimizing…", () => mediaFromLink(url), "That link could not be used") : undefined
  const canvaMedia = (r: CreateRow, link: string, as: "video" | "photo") => takeMedia(r, `Exporting the Canva design as ${as === "video" ? "MP4" : "JPG"}…`, () => mediaFromCanva(link, as), "The Canva design could not be exported")

  async function runRow(r: CreateRow): Promise<boolean> {
    patchState(r.id, s => ({ ...s, busy: "run", message: "Filling Canva templates…", error: undefined }))
    try {
      const res = await fetch("/api/admin/content/create-run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row: r }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Run job failed for this row")
      patchState(r.id, { posts: data.posts, done: true, message: `In Review: ${(data.posts as RunPost[]).map(p => FORMAT_LABEL[p.format]).join(" + ")}` })
      return true
    } catch (e) { patchState(r.id, { error: e instanceof Error ? e.message : "Run job failed" }); return false }
  }
  async function runJob() {
    setRunning(true)
    let made = 0
    for (const r of rows) {
      if (state[r.id]?.done) continue
      const problems = rowProblems(r, templateOf(r))
      if (!r.headline.trim() && !r.caption.trim() && !r.referenceLink.trim()) continue // an empty row is skipped quietly
      if (problems.length) { patchState(r.id, s => ({ ...s, error: problems.join(" · ") })); continue }
      if (await runRow(r)) made++
    }
    setRunning(false)
    if (made) onPostsReady?.()
  }
  function clearDone() {
    setRows(rs => { const left = rs.filter(r => !state[r.id]?.done); return left.length ? left : [blankRow(rs[0]?.brand, rs[0]?.kind)] })
  }

  const ready = rows.filter(r => !state[r.id]?.done && !rowProblems(r, templateOf(r)).length).length

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 transition-colors text-sm font-medium shrink-0">
        <Plus className="w-4 h-4" /> Create
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col" role="dialog" aria-label="Create posts">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-b border-neutral-200 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-neutral-900">Create</h2>
              <p className="text-xs text-neutral-500 truncate">One row is one post. Human+ drafts a row from its reference link; Run job makes the Canva designs and puts them in Review.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={clearDone} className="hidden sm:inline-flex h-9 px-3 text-sm text-neutral-600 hover:text-neutral-900">Clear finished rows</button>
              <button onClick={runJob} disabled={running || !ready} className="inline-flex items-center gap-2 h-9 px-4 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-40 text-sm font-medium">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run job{ready ? ` (${ready})` : ""}
              </button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-neutral-100"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {configError && <p className="m-4 text-sm text-red-600">{configError} <button className="underline" onClick={loadConfig}>Try again</button></p>}
            {!config && !configError && <p className="m-4 text-sm text-neutral-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading brands…</p>}
            {config && (
              <table className="min-w-[1500px] w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-neutral-50 z-10">
                  <tr className="text-left text-xs font-medium text-neutral-500">
                    {["", "Brand", "Template", "Reference link", "Media", "Target platforms", "Headline", "Sub-headline", "Caption", "Date", ""].map((h, i) => <th key={i} className="px-2 py-2 border-b border-neutral-200 font-medium">
                      <span className="inline-flex items-center gap-1">{h}{COLUMN_HELP[h] && <HelpTip label={h}>{COLUMN_HELP[h]}</HelpTip>}</span>
                    </th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, n) => {
                    const brand = brandOf(r), t = templateOf(r), s = state[r.id] ?? {}
                    const head = t?.fields.find(f => f.role === "headline"), sub = t?.fields.find(f => f.role === "subHeadline"), extras = t?.fields.filter(f => f.role === "extra") ?? []
                    const locked = !!s.done || !!s.busy
                    const formats = formatsOf(r.platforms)
                    return (
                      <tr key={r.id} className={`align-top border-b border-neutral-100 ${s.done ? "bg-emerald-50/40" : ""}`}>
                        <td className="px-2 py-2 text-xs text-neutral-400 w-6">{n + 1}</td>
                        <td className="px-2 py-2 w-36">
                          <select disabled={locked} value={r.brand} onChange={e => { const b = config.brands.find(x => x.id === e.target.value); patch(r.id, { brand: e.target.value, kind: b?.templates.length === 1 ? b.templates[0].kind : "" }) }} className="w-full h-8 rounded border border-neutral-300 px-1 bg-white">
                            <option value="">Brand…</option>
                            {config.brands.map(b => <option key={b.id} value={b.id} disabled={!b.active}>{b.label}{b.active ? "" : ` (${b.reason})`}</option>)}
                          </select>
                          {brand?.versionId && <p className="mt-1 text-[11px] text-neutral-400">{brand.versionId}</p>}
                        </td>
                        <td className="px-2 py-2 w-44">
                          {!brand && <p className="text-xs text-neutral-400">Choose a Brand to see its templates</p>}
                          {brand?.templates.map(x => {
                            // Each row holds one template; ticking another adds a row for it.
                            const mine = x.kind === r.kind
                            return (
                              <label key={x.kind} className="flex items-start gap-1.5 text-xs py-0.5" title={x.detail}>
                                <input type="checkbox" className="mt-0.5" disabled={locked} checked={mine} onChange={e => e.target.checked ? pickTemplate(r, x.kind) : patch(r.id, { kind: "" })} />
                                <span>{x.label}</span>
                              </label>
                            )
                          })}
                          {t && <p className="mt-1 text-[11px] text-neutral-400">{t.detail}</p>}
                          {brand && brand.templates.length > 1 && <p className="mt-1 text-[11px] text-neutral-400">Tick another template to add a row for it.</p>}
                        </td>
                        <td className="px-2 py-2 w-64">
                          <input disabled={locked} value={r.referenceLink} onChange={e => patch(r.id, { referenceLink: e.target.value.trim() })} placeholder="https://…" className="w-full h-8 rounded border border-neutral-300 px-2" />
                          <textarea disabled={locked} value={r.notes} onChange={e => patch(r.id, { notes: e.target.value })} placeholder="Starter notes (optional): angle, emphasis" rows={2} className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-xs" />
                          <button disabled={locked || !t || !r.referenceLink} onClick={() => humanPlus(r)} className="mt-1 inline-flex items-center gap-1.5 h-7 px-2.5 rounded border border-neutral-300 text-xs font-medium hover:bg-neutral-50 disabled:opacity-40">
                            {s.busy === "human" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />} Human+
                          </button>
                        </td>
                        <td className="px-2 py-2 w-44">
                          <MediaCell row={r} disabled={locked} onFile={f => dropFile(r, f)} onUrl={u => pasteMedia(r, u)} onCanva={(u, as) => canvaMedia(r, u, as)} onClear={() => setRows(rs => rs.map(x => x.id === r.id ? fit({ ...x, media: null }, mediaShapeOf(x.media) !== "photo") : x))} />
                        </td>
                        <td className="px-2 py-2 w-40">
                          {/* One size per platform per row (Step 3 part 5): the size follows the media. */}
                          {CREATE_SOCIALS.map(platform => {
                            const shape = mediaShapeOf(r.media)
                            const choices = formatChoices(platform, shape).filter(f => !!t?.templates[f])
                            const picked = pickedFormat(r.platforms, platform), on = !!picked && choices.includes(picked)
                            const format = on ? picked : choices[0]
                            const hand = config.platforms.find(p => p.platform === platform)?.posting === "hand"
                            const set = (f: CreateFormat | null) => patch(r.id, { platforms: [...r.platforms.filter(id => config.platforms.find(p => p.id === id)?.platform !== platform), ...(f ? [platformIdOf(platform, f)!] : [])] })
                            return (
                              <div key={platform} className={`flex items-center gap-1.5 text-xs py-0.5 ${choices.length ? "" : "text-neutral-400"}`}>
                                <label className="inline-flex items-center gap-1.5">
                                  <input type="checkbox" disabled={locked || !choices.length} checked={on} onChange={e => set(e.target.checked ? format! : null)} /> {SOCIAL_LABEL[platform]}
                                </label>
                                {format && (choices.length > 1
                                  ? <select aria-label={`${SOCIAL_LABEL[platform]} size`} disabled={locked || !on} value={format} onChange={e => set(e.target.value as CreateFormat)} className="h-6 rounded border border-neutral-300 px-0.5 bg-white text-[11px]">
                                      {choices.map(f => <option key={f} value={f}>{choiceLabel(platform, f, shape)}</option>)}
                                    </select>
                                  : <span className="text-neutral-400">· {choiceLabel(platform, format, shape)}{hand ? " · by hand" : ""}</span>)}
                                {format && <HelpTip label={`${SOCIAL_LABEL[platform]} size`}>{choiceHelp(platform, format, shape)}</HelpTip>}
                              </div>
                            )
                          })}
                          {/* A missing template is a gap with a note, never a fallback (plan v11.1 Step 3 item 3). */}
                          {(["feed", "reels"] as const).map(f => templateGap(t, brand?.label ?? "this Brand", f)).filter(Boolean).map(note => <p key={note} className="mt-1 text-[11px] text-amber-700">{note}</p>)}
                          {formats.length > 0 && <p className="mt-1 text-[11px] text-neutral-400">{formats.map(f => FORMAT_LABEL[f.format]).join(" + ")}</p>}
                        </td>
                        <td className="px-2 py-2 w-52"><Cell field={head} value={r.headline} disabled={locked} rows={3} onChange={v => patch(r.id, { headline: v })} /></td>
                        <td className="px-2 py-2 w-52">
                          <Cell field={sub} value={r.subHeadline} disabled={locked || !sub} rows={3} onChange={v => patch(r.id, { subHeadline: v })} />
                          {extras.map(f => <div key={f.name} className="mt-1"><Cell field={f} value={r.fields[f.name] ?? ""} disabled={locked} rows={1} onChange={v => patch(r.id, { fields: { ...r.fields, [f.name]: v } })} /></div>)}
                        </td>
                        <td className="px-2 py-2 w-80">
                          <textarea disabled={locked} value={r.caption} onChange={e => patch(r.id, { caption: e.target.value })} rows={6} placeholder="Caption" className="w-full rounded border border-neutral-300 px-2 py-1 text-xs leading-relaxed" />
                          <p className={`text-[11px] ${r.caption.length > 2100 ? "text-red-600" : "text-neutral-400"}`}>{r.caption.length}/2100</p>
                        </td>
                        <td className="px-2 py-2 w-36">
                          <input type="date" disabled={locked} value={r.date} onChange={e => patch(r.id, { date: e.target.value })} className="w-full h-8 rounded border border-neutral-300 px-1" />
                          {r.fields.date && <p className="mt-1 text-[11px] text-neutral-400">Card date {r.fields.date}</p>}
                        </td>
                        <td className="px-2 py-2 w-56 text-xs">
                          {s.busy && <p className="text-neutral-600 inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {s.message}</p>}
                          {!s.busy && s.message && <p className="text-neutral-600">{s.message}</p>}
                          {s.hold && <p className="text-amber-700">Human+ held this row: {s.hold}</p>}
                          {s.notes?.map((x, i) => <p key={i} className="text-amber-700">Note: {x}</p>)}
                          {s.error && <p className="text-red-600">{s.error}</p>}
                          {[...new Set(s.posts?.flatMap(p => p.holds) ?? [])].map(h => <p key={h} className="text-amber-700">{h}</p>)}
                          {s.posts?.map(p => (
                            <a key={p.postId} href={`/admin/content?openContent=${p.postId}`} className="mt-1 flex items-center gap-1 text-emerald-700 hover:underline"><Check className="w-3.5 h-3.5" /> {FORMAT_LABEL[p.format]} in Review <ArrowUpRight className="w-3 h-3" /></a>
                          ))}
                          {!s.done && !s.busy && (
                            <button onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} className="mt-1 inline-flex items-center gap-1 text-neutral-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /> Remove row</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {config && (
              <div className="p-4">
                <button onClick={() => setRows(rs => [...rs, ...Array.from({ length: 5 }, () => blankRow(rs[rs.length - 1]?.brand, rs[rs.length - 1]?.kind))])} className="inline-flex items-center gap-2 h-8 px-3 rounded border border-neutral-300 text-sm hover:bg-neutral-50">
                  <Plus className="w-4 h-4" /> Add rows
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Cell({ field, value, disabled, rows, onChange }: { field?: CellField; value: string; disabled?: boolean; rows: number; onChange(v: string): void }) {
  const note = limitNote(field, value)
  return (
    <div>
      {field?.allowed ? (
        <select disabled={disabled} value={value} onChange={e => onChange(e.target.value)} className="w-full h-8 rounded border border-neutral-300 px-1 bg-white text-xs">
          <option value="">{field.label}…</option>
          {field.allowed.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      ) : (
        <textarea disabled={disabled} value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={field?.label ?? "—"} className={`w-full rounded border px-2 py-1 text-xs ${field?.uppercase ? "uppercase" : ""} ${note?.over ? "border-red-400" : "border-neutral-300"}`} />
      )}
      {note && <p className={`text-[11px] ${note.over ? "text-red-600" : "text-neutral-400"}`}>{field!.label} · {note.text}</p>}
    </div>
  )
}

function MediaCell({ row, disabled, onFile, onUrl, onCanva, onClear }: { row: CreateRow; disabled?: boolean; onFile(f: File): void; onUrl(u: string): void; onCanva(u: string, as: "video" | "photo"): void; onClear(): void }) {
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState("")
  // A Canva design link waits for one choice: export it as a video (MP4) or a photo (JPG).
  const [canva, setCanva] = useState("")
  const take = () => { const u = url.trim(); setUrl(""); if (!u) return; if (isCanvaLink(u)) setCanva(u); else onUrl(u) }
  const m = row.media
  if (m) return (
    <div className="text-xs">
      {/* eslint-disable-next-line @next/next/no-img-element -- a Blob thumbnail in an admin table, not page content */}
      {m.kind === "image" ? <img src={m.url} alt="" className="w-full h-24 object-cover rounded border border-neutral-200" /> : <video src={m.url} muted playsInline controls className="w-full h-24 object-cover rounded border border-neutral-200 bg-black" />}
      <p className="mt-1 truncate text-neutral-500" title={m.name}>{m.optimized === "done" ? "✓ " : ""}{m.name}</p>
      {!disabled && <button onClick={onClear} className="text-neutral-400 hover:text-red-600">Replace</button>}
    </div>
  )
  return (
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && !disabled) onFile(f) }} className="rounded border border-dashed border-neutral-300 p-2 text-xs text-neutral-500">
      <button disabled={disabled} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 hover:text-neutral-900"><Upload className="w-3.5 h-3.5" /> Drop or choose an image or video</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff,video/mp4,video/quicktime,video/x-m4v,video/webm" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }} />
      {canva ? <CanvaChoice onPick={as => { const u = canva; setCanva(""); onCanva(u, as) }} onCancel={() => setCanva("")} disabled={disabled} />
        : <input disabled={disabled} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") take() }} onBlur={take} placeholder="or paste a link" className="mt-1 w-full h-7 rounded border border-neutral-200 px-1.5" />}
    </div>
  )
}

/** The one choice a Canva design link needs: the app exports it as MP4 or JPG. Shared with the drawer's Replace media. */
export function CanvaChoice({ onPick, onCancel, disabled }: { onPick(as: "video" | "photo"): void; onCancel(): void; disabled?: boolean }) {
  return (
    <div className="mt-1 space-y-1">
      <p className="text-neutral-700">Canva design: use it as</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={disabled} onClick={() => onPick("video")} className="h-7 px-2 rounded border border-neutral-300 text-neutral-800 hover:bg-neutral-50 disabled:opacity-40">Video (MP4)</button>
        <button type="button" disabled={disabled} onClick={() => onPick("photo")} className="h-7 px-2 rounded border border-neutral-300 text-neutral-800 hover:bg-neutral-50 disabled:opacity-40">Photo (JPG)</button>
        <button type="button" onClick={onCancel} className="h-7 px-1.5 text-neutral-400 hover:text-neutral-700">Cancel</button>
      </div>
    </div>
  )
}

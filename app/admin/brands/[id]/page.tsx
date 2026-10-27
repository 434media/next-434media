"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Check, Circle, History, Loader2, RotateCcw, Save, Upload } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { BrandStateBadge } from "@/components/admin/brands/BrandStateBadge"
import { BrandBook } from "@/components/admin/brands/BrandBook"
import { BrandShares } from "@/components/admin/brands/BrandShares"
import type { BrandBook as Book } from "@/lib/content-pipeline/brand-book"
import type { BrandState, CheckItem } from "@/lib/content-pipeline/brand-status"
import type { McuSeeds } from "@/lib/content-pipeline/seeds"

/**
 * One brand's page in the Brands area (plan v11.2.1 Step 4 item 2): the onboarding checklist (Brand Onboarding SOP),
 * the missing templates, the Sources, and the profile editor: the draft is edited as JSON, saved, and published
 * (validated by the engine's own validator; an invalid draft is refused with its problems). Every published version is
 * listed, and any earlier one can be restored in one click (republished as a new version). Owned and client brands use
 * the same page. 434 staff (interns excluded, as /admin/brand) see the status, Missing and the brand book; the checklist,
 * the private Sources and the profile editor are for super-admins, who edit and publish.
 */
interface Version { versionId: string; n: number; profileVersion: string; sha256: string; publishedBy: string; publishedAt: string; restoredFrom: string | null }
interface BrandView {
  canEdit: boolean
  brand: { id: string; label: string; brandType: "owned" | "client" | null; onRoster: boolean; state: BrandState; versionId: string | null; publishedAt: string | null; publishedBy: string | null; problem: string | null; draftDiffers: boolean; postsMade: number }
  missing: string[]
  book: { versionId: string; book: Book } | null
  // Super-admins only (canEdit).
  checklist?: CheckItem[]
  sources?: { pointer: string | null; note: string | null; seeds: McuSeeds | null }
  doc?: { brand_type: string; client_id: string | null; identity: { source: string; record: string }; draft: { profile: unknown; examples: unknown; updated_by: string; updated_at: string } | null; draftToken: string; draftHasBook: boolean; last_version: number; published: { version_id: string } | null } | null
  draftProblems?: string[]
  versions?: Version[]
}

const draftText = (d: BrandView["doc"]) => d?.draft ? JSON.stringify({ profile: d.draft.profile, examples: d.draft.examples }, null, 2) : ""

export default function BrandPage() {
  const id = String(useParams<{ id: string }>().id ?? "")
  const [view, setView] = useState<BrandView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string; problems?: string[] } | null>(null)
  const token = useRef<string | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/brands/${encodeURIComponent(id)}`, { cache: "no-store" })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Could not read the brand")
      setView(data as BrandView)
      setText(draftText((data as BrandView).doc))
      // The draft this page shows: Save, Publish and Restore send it back, and a draft saved since is refused.
      token.current = (data as BrandView).doc?.draftToken
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the brand") }
  }, [id])
  useEffect(() => { load() }, [load])

  const saved = view ? draftText(view.doc) : ""
  const edited = text !== saved

  /** Saves the draft; returns false (with the reason shown) when it can't be saved. */
  async function save(): Promise<boolean> {
    let body: { profile: unknown; examples: unknown }
    try { body = JSON.parse(text) } catch (e) { setResult({ ok: false, message: `The draft is not valid JSON: ${e instanceof Error ? e.message : "parse error"}` }); return false }
    const r = await fetch(`/api/admin/brand-profiles/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: body?.profile, examples: body?.examples ?? { approved: [], rejected: [] }, expectedDraft: token.current }) })
    const data = await r.json()
    if (!r.ok) { setResult({ ok: false, message: data.error || "Could not save the draft", problems: data.problems }); return false }
    token.current = data.draftToken
    setResult({ ok: true, message: data.publishProblems?.length ? "Draft saved. Publish would refuse it until these are fixed:" : "Draft saved. It can be published.", problems: data.publishProblems })
    return true
  }
  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name); setResult(null)
    try { await fn() } catch (e) { setResult({ ok: false, message: e instanceof Error ? e.message : "Something went wrong" }) }
    finally { setBusy(null) }
  }
  const saveDraft = () => act("save", async () => { if (await save()) await load() })
  const publish = () => act("publish", async () => {
    if (edited && !await save()) return
    const r = await fetch(`/api/admin/brand-profiles/${encodeURIComponent(id)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedDraft: token.current }) })
    const data = await r.json()
    if (!r.ok) { setResult({ ok: false, message: data.error || "Could not publish", problems: data.problems }); await load(); return }
    await load()
    setResult({ ok: true, message: `Published ${data.versionId}. It governs the next request.${data.bookProblem ? ` Its brand book isn't shown: ${data.bookProblem}.` : ""}` })
  })
  const restore = (v: Version) => act(`restore-${v.versionId}`, async () => {
    const unpublished = !!view?.brand.draftDiffers || edited
    if (!window.confirm(`Restore ${v.versionId}? It is published again as a new version and becomes the draft.${unpublished ? "\n\nThe draft has unpublished edits. They are kept aside (the last two), not lost." : ""}`)) return
    if (edited && !await save()) return
    const r = await fetch(`/api/admin/brand-profiles/${encodeURIComponent(id)}/restore`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionId: v.versionId, force: unpublished, expectedDraft: token.current }) })
    const data = await r.json()
    if (!r.ok) { setResult({ ok: false, message: data.error || "Could not restore", problems: data.problems }); return }
    await load()
    setResult({ ok: true, message: `Restored ${data.restoredFrom} as ${data.versionId}.` })
  })

  const b = view?.brand
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only"]}>
      <div className="min-h-full bg-neutral-50 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Link href="/admin/brands" className="flex w-fit items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"><ArrowLeft className="w-3.5 h-3.5" /> Brands</Link>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!view && !error && <p className="text-sm text-neutral-500 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Reading the brand…</p>}
          {view && b && <>
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-neutral-900">{b.label}</h1>
                <BrandStateBadge state={b.state} />
                {b.brandType && <span className="text-xs text-neutral-500">{b.brandType === "client" ? "Client brand" : "Owned brand"}</span>}
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {b.versionId ? <>Profile <span className="font-mono">{b.versionId}</span>, published by {b.publishedBy} on {b.publishedAt?.slice(0, 10)}.</> : b.problem ? `Not live: ${b.problem}.` : "No profile yet."}
                {b.postsMade ? ` ${b.postsMade} post${b.postsMade === 1 ? "" : "s"} made under its profile.` : ""}
              </p>
            </header>

            <Section open title="Brand book" note="What a designer needs: colour, type, logos and photography. This is the brand book a vendor is sent.">
              {view.book ? <BrandBook book={view.book.book} brand={b.label} versionId={view.book.versionId} view="designer" collapsible />
                : <p className="text-sm text-neutral-500">No brand book yet. A working session generates it from the brand&apos;s visual standard into the draft (scripts/brand-profiles/profile.ts book); it appears here once that draft is published.</p>}
            </Section>

            {view.book && <Section open title="Share with vendor" note="Emails a designer an expiring link to the brand book above, pinned to this version. Each send is recorded; each opening of the link too.">
              <BrandShares brandId={b.id} brand={b.label} versionId={view.book.versionId} />
            </Section>}

            {view.canEdit && <Section title="Internal" note="Super-admins only: template specs, setup, sources, the profile and its history. Nothing here is sent to a designer.">
              <div className="space-y-3">
                {view.book && <Section nested title="Full visual standard and template specs" note="The whole standard the brand book is drawn from, as the pipeline uses it. Parts kept out of the designer's copy are marked.">
                  <BrandBook book={view.book.book} brand={b.label} versionId={view.book.versionId} view="full" collapsible />
                </Section>}

                {view.checklist && <Section nested title="Onboarding checklist" note="From the Brand Onboarding SOP. A step is ticked only from what the system can see.">
                <ol className="space-y-2">
                  {view.checklist.map(c => (
                    <li key={c.step} className="flex gap-2">
                      {c.status === "done" ? <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 mt-0.5 text-neutral-300 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-900">{c.step}. {c.title}</p>
                        <p className="text-xs text-neutral-500">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>}

                <Section nested title="Missing templates" note="A template that doesn't exist can't be ticked in Create.">
                {view.missing.length
                  ? <ul className="space-y-1">{view.missing.map(m => <li key={m} className="text-sm text-amber-800">{m}</li>)}</ul>
                  : <p className="text-sm text-neutral-500">Nothing missing.</p>}
              </Section>

            {view.sources && <Section nested title="Brand sources" note="Where research looks first. The seeds are private: they live in the database, never in the profile or the public repository.">
              <Sources sources={view.sources} />
            </Section>}

            <Section nested title="Profile" note="Edits are a draft and change nothing until Publish. Publish validates the draft with the engine's own validator and refuses an invalid one.">
              {!view.doc ? (
                <p className="text-sm text-neutral-500">No profile document for this brand yet. A working session creates it (scripts/brand-profiles/profile.ts create); then it is edited here.</p>
              ) : <>
                <p className="text-xs text-neutral-500">
                  {view.doc.draft ? <>Draft saved by {view.doc.draft.updated_by} on {view.doc.draft.updated_at.slice(0, 16).replace("T", " ")}. </> : "No draft yet. "}
                  {b.draftDiffers ? <span className="text-amber-700">It has edits that aren&apos;t published.</span> : view.doc.published ? <>It matches {view.doc.published.version_id}.</> : null}
                  {edited && <span className="text-amber-700"> Changed here, not saved.</span>}
                </p>
                {!!view.draftProblems?.length && !edited && <Problems title="Publish would refuse the saved draft until these are fixed:" problems={view.draftProblems} />}
                <textarea aria-label="Draft profile (JSON)" value={text} onChange={e => setText(e.target.value)} spellCheck={false} rows={24}
                  className="mt-2 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs leading-relaxed" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button onClick={saveDraft} disabled={!!busy || !edited} className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40">
                    {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save draft
                  </button>
                  <button onClick={publish} disabled={!!busy || (!edited && !b.draftDiffers && !!view.doc.published)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-neutral-900 text-white text-sm hover:bg-neutral-800 disabled:opacity-40">
                    {busy === "publish" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Publish
                  </button>
                  {edited && <button onClick={() => { setText(saved); setResult(null) }} disabled={!!busy} className="h-8 px-2 text-sm text-neutral-500 hover:text-neutral-900">Undo changes</button>}
                </div>
                {view.doc.draftHasBook && <p className="mt-2 text-[11px] text-neutral-400">The brand book (<span className="font-mono">visual</span>) is generated from the visual standard and isn&apos;t edited here; saving keeps it as it is.</p>}
                {result && <div className="mt-2">{result.problems?.length ? <Problems title={result.message} problems={result.problems} tone={result.ok ? "amber" : "red"} /> : <p className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>}</div>}
              </>}
            </Section>

            {!!view.versions?.length && (
              <Section nested title="History" note="Every published version is kept. Restore publishes an earlier one again as a new version; history is never rewritten.">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-neutral-500"><th className="py-1 pr-3 font-medium">Version</th><th className="py-1 pr-3 font-medium">Profile</th><th className="py-1 pr-3 font-medium">Published</th><th className="py-1 font-medium"></th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                      {view.versions!.map(v => {
                        const live = v.versionId === b.versionId
                        return (
                          <tr key={v.versionId}>
                            <td className="py-1.5 pr-3 font-mono text-xs">{v.versionId}{live && <span className="ml-1.5 font-sans text-[11px] text-emerald-700">live</span>}</td>
                            <td className="py-1.5 pr-3 text-xs text-neutral-600">{v.profileVersion}{v.restoredFrom ? ` · restored from ${v.restoredFrom}` : ""}</td>
                            <td className="py-1.5 pr-3 text-xs text-neutral-600">{v.publishedAt.slice(0, 16).replace("T", " ")} · {v.publishedBy}</td>
                            <td className="py-1.5 text-right">
                              {!live && <button onClick={() => restore(v)} disabled={!!busy} className="inline-flex items-center gap-1 h-7 px-2 rounded border border-neutral-300 bg-white text-xs hover:bg-neutral-50 disabled:opacity-40">
                                {busy === `restore-${v.versionId}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore
                              </button>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-neutral-400 inline-flex items-center gap-1"><History className="w-3 h-3" /> 434-context keeps each published version as a record, pulled daily.</p>
              </Section>
            )}
              </div>
            </Section>}
          </>}
        </div>
      </div>
    </AdminRoleGuard>
  )
}

/** A card that folds under its title. `open` starts it unfolded; `nested` is a card inside another (Internal). */
function Section({ title, note, open = false, nested = false, children }: { title: string; note?: string; open?: boolean; nested?: boolean; children: React.ReactNode }) {
  return (
    // min-w-0 and overflow-wrap: anywhere keep a long unbroken value (a sheet id, an email) inside the card on a phone.
    <details open={open} className={`group/card min-w-0 rounded-lg border border-neutral-200 [overflow-wrap:anywhere] ${nested ? "bg-neutral-50 p-3" : "bg-white p-4"}`}>
      <summary className="cursor-pointer list-none marker:hidden">
        <h2 className="inline text-sm font-semibold text-neutral-900"><span className="mr-1.5 inline-block text-neutral-400 transition-transform group-open/card:rotate-90">›</span>{title}</h2>
        {note && <p className="mt-0.5 pl-4 text-xs text-neutral-500">{note}</p>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}

function Problems({ title, problems, tone = "red" }: { title: string; problems: string[]; tone?: "red" | "amber" }) {
  return (
    <div className={`mt-2 rounded border px-3 py-2 text-xs ${tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-disc pl-4 space-y-0.5">{problems.slice(0, 30).map((p, i) => <li key={i}>{p}</li>)}</ul>
      {problems.length > 30 && <p className="mt-1">…and {problems.length - 30} more.</p>}
    </div>
  )
}

function Sources({ sources }: { sources: NonNullable<BrandView["sources"]> }) {
  const s = sources.seeds
  if (!sources.pointer) return <p className="text-sm text-neutral-500">No seeds named for this brand yet.{sources.note ? ` ${sources.note}` : ""}</p>
  if (!s) return <p className="text-sm text-amber-800">The profile names <span className="font-mono">{sources.pointer}</span>, which isn&apos;t loaded.</p>
  const kinds = [...new Set(s.orgs.map(o => o.kind))]
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-500"><span className="font-mono">{sources.pointer}</span> · {s.snapshot}{s.updatedAt ? ` · loaded ${s.updatedAt.slice(0, 10)}${s.updatedBy ? ` by ${s.updatedBy}` : ""}` : ""}</p>
      {sources.note && <p className="text-xs text-neutral-500">{sources.note}</p>}
      <p className="text-neutral-700">{s.purpose}</p>
      {s.cohorts.length > 0 && <div><p className="text-xs font-medium text-neutral-500">Source cohorts</p><ul className="mt-1 list-disc pl-4 text-neutral-700">{s.cohorts.map(c => <li key={c}>{c}</li>)}</ul></div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {kinds.map(k => (
          <div key={k}>
            <p className="text-xs font-medium text-neutral-500">{k} ({s.orgs.filter(o => o.kind === k).length})</p>
            <ul className="mt-1 space-y-0.5 text-xs text-neutral-700">{s.orgs.filter(o => o.kind === k).map(o => <li key={`${o.name}-${o.site}`}>{o.name} <span className="text-neutral-400">{o.site}</span></li>)}</ul>
          </div>
        ))}
      </div>
      {s.dt101Backlog.length > 0 && <p className="text-xs text-neutral-500">{s.dt101Backlog.length} backlog ideas, {s.dt101Covered.length} subjects already covered.</p>}
    </div>
  )
}

"use client"

import { useState } from "react"
import { AlertTriangle, Check, FlaskConical, Loader2, SearchCheck } from "lucide-react"
import type { TemplateCheckRow } from "@/lib/content-pipeline/template-check"

/**
 * The template check on a brand's page (pre-run, founder 2026-10-29): reads every template the published profile binds
 * from Canva and lists any whose photo frame or card fields are missing. Run on demand, never on a schedule. A
 * super-admin can also test-fill a template's photo frame: the only check that catches a frame Canva still lists but the
 * template no longer has.
 */
interface CheckView { versionId: string; checkedAt: string; rows: TemplateCheckRow[]; limit: string; canTestFill: boolean }
interface Probe { outcome: "filled" | "autofill_error" | "error"; reason: string; cleanup: string[] }

export function TemplateCheck({ brandId }: { brandId: string }) {
  const [view, setView] = useState<CheckView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [probes, setProbes] = useState<Record<string, Probe | { failed: string }>>({})
  const url = `/api/admin/brands/${encodeURIComponent(brandId)}/templates`

  async function check() {
    setBusy("check"); setError(null)
    try {
      const r = await fetch(url, { cache: "no-store" })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Could not check the templates")
      setView(data as CheckView); setProbes({})
    } catch (e) { setError(e instanceof Error ? e.message : "Could not check the templates") }
    finally { setBusy(null) }
  }
  async function testFill(row: TemplateCheckRow) {
    const key = `${row.series}:${row.format}`
    if (!window.confirm(`Test-fill ${row.label}?\n\nThis makes a throwaway design titled "434 template check (safe to delete)" in the connected Canva account, then moves it and its grey test image to Canva's Trash.`)) return
    setBusy(key)
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ series: row.series, format: row.format }) })
      const data = await r.json()
      setProbes(p => ({ ...p, [key]: r.ok ? data as Probe : { failed: data.error || "The test fill couldn't run" } }))
    } catch { setProbes(p => ({ ...p, [key]: { failed: "The test fill couldn't run" } })) }
    finally { setBusy(null) }
  }

  const broken = view?.rows.filter(r => r.problems.length) ?? []
  return (
    <div className="space-y-3">
      <button onClick={check} disabled={!!busy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-neutral-300 bg-white text-sm hover:bg-neutral-50 disabled:opacity-40">
        {busy === "check" ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />} {view ? "Check again" : "Check templates"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {view && <>
        <p className={`text-sm ${broken.length ? "text-red-700" : "text-emerald-700"}`}>
          {broken.length ? `${broken.length} of ${view.rows.length} templates need fixing in Canva before a run can use them.` : `All ${view.rows.length} templates list every field ${view.versionId} needs.`}
          <span className="text-xs text-neutral-500"> Checked {view.checkedAt.slice(0, 16).replace("T", " ")} against {view.versionId}.</span>
        </p>
        <ul className="divide-y divide-neutral-100">
          {view.rows.map(r => {
            const key = `${r.series}:${r.format}`, probe = probes[key]
            return (
              <li key={key} className="py-2 flex gap-2">
                {r.problems.length ? <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-900">{r.label} <span className="font-mono text-[11px] text-neutral-400">{r.templateId}</span></p>
                  {r.problems.map(p => <p key={p} className="text-xs text-red-700">{p}</p>)}
                  {!r.problems.length && <p className="text-xs text-neutral-500">{r.mediaField ? `Photo frame "${r.mediaField}" and every card field listed.` : "Every card field listed (no photo frame)."}</p>}
                  {probe && ("failed" in probe ? <p className="text-xs text-red-700">{probe.failed}</p> : <>
                    <p className={`text-xs ${probe.outcome === "filled" ? "text-emerald-700" : probe.outcome === "autofill_error" ? "text-red-700" : "text-amber-800"}`}>Test fill: {probe.reason}.</p>
                    {probe.cleanup.map(c => <p key={c} className="text-xs text-amber-800">{c}</p>)}
                  </>)}
                </div>
                {view.canTestFill && r.mediaField && !r.problems.length && (
                  <button onClick={() => testFill(r)} disabled={!!busy} className="self-start inline-flex items-center gap-1 h-7 px-2 rounded border border-neutral-300 bg-white text-xs hover:bg-neutral-50 disabled:opacity-40">
                    {busy === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />} Test fill
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="text-[11px] text-neutral-400">{view.limit}{view.canTestFill ? " Test fill tries one template's photo frame for real." : ""}</p>
      </>}
    </div>
  )
}

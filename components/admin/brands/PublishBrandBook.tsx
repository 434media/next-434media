"use client"

import { useState } from "react"
import { Check, CircleAlert, Loader2, Search, Upload } from "lucide-react"

/**
 * Publish brand book (lib/brand-book-publish.ts): Check reads the newest copy of the brand's visual standard in
 * storage and shows what would be published; Publish brand book publishes exactly that, as the profile's next version.
 * Super-admins only. Nothing is written by Check.
 */
interface Plan {
  standard: { path: string; title: string; version: string; sha256: string } | null
  publishedVersion: string | null
  nextVersion: string
  files: { file: string; state: "ok" | "missing" | "changed" | "unrecorded" }[]
  current: boolean
  problems: string[]
  token: string
}

const STATE: Record<Plan["files"][number]["state"], string> = { ok: "In storage, unchanged", missing: "Not in storage", changed: "Changed since published", unrecorded: "No recorded checksum" }

export function PublishBrandBook({ brandId, onPublished }: { brandId: string; onPublished: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<"check" | "publish" | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string; problems?: string[] } | null>(null)
  const url = `/api/admin/brand-profiles/${encodeURIComponent(brandId)}/book`

  async function check() {
    setBusy("check"); setResult(null); setPlan(null)
    try {
      const r = await fetch(url, { cache: "no-store" })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Could not check")
      setPlan(data as Plan)
    } catch (e) { setResult({ ok: false, message: e instanceof Error ? e.message : "Could not check" }) }
    finally { setBusy(null) }
  }
  async function publish() {
    if (!plan) return
    setBusy("publish"); setResult(null)
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: plan.token }) })
      const data = await r.json()
      if (!r.ok) { setResult({ ok: false, message: data.error || "Could not publish", problems: data.problems }); if (data.plan) setPlan(data.plan); return }
      setPlan(null)
      setResult({ ok: true, message: data.current ? `Already published as ${data.versionId}. Nothing changed.` : `Published ${data.versionId}. Vendors are sent this brand book from now on.` })
      onPublished()
    } catch (e) { setResult({ ok: false, message: e instanceof Error ? e.message : "Could not publish" }) }
    finally { setBusy(null) }
  }

  const ready = !!plan && !plan.problems.length && !plan.current
  return (
    <div className="space-y-3">
      <button type="button" onClick={check} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
        {busy === "check" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Check
      </button>

      {plan && <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Standard</dt>
          <dd className="min-w-0 text-neutral-900">{plan.standard ? <>{plan.standard.title}, {plan.standard.version} <span className="font-mono text-xs text-neutral-500">{plan.standard.sha256}</span></> : "None in storage"}</dd>
          <dt className="text-neutral-500">Published now</dt>
          <dd className="font-mono text-neutral-900">{plan.publishedVersion ?? "none"}</dd>
          <dt className="text-neutral-500">Would publish</dt>
          <dd className="font-mono text-neutral-900">{plan.current ? "nothing: this book is already published" : plan.nextVersion}</dd>
        </dl>
        {!!plan.files.length && <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="py-1 pr-4 font-medium">File the standard names</th><th className="py-1 font-medium">Storage</th></tr></thead>
            <tbody>{plan.files.map(f => (
              <tr key={f.file} className="border-t border-neutral-200">
                <td className="py-1 pr-4 font-mono text-xs text-neutral-900">{f.file}</td>
                <td className={`py-1 ${f.state === "ok" ? "text-emerald-700" : "text-red-600"}`}>{STATE[f.state]}</td>
              </tr>))}</tbody>
          </table>
        </div>}
        {!!plan.problems.length && <ul className="space-y-1">{plan.problems.map(p => <li key={p} className="flex gap-1.5 text-sm text-red-600"><CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />{p}</li>)}</ul>}
        <button type="button" onClick={publish} disabled={!ready || !!busy} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-40">
          {busy === "publish" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Publish brand book
        </button>
      </div>}

      {result && <div className={`text-sm ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
        <p className="flex gap-1.5">{result.ok && <Check className="w-4 h-4 mt-0.5 shrink-0" />}{result.message}</p>
        {result.problems && <ul className="mt-1 list-disc pl-5">{result.problems.map(p => <li key={p}>{p}</li>)}</ul>}
      </div>}
    </div>
  )
}

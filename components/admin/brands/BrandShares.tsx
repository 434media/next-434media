"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Ban, Loader2, Send } from "lucide-react"
import { commandPrefill, dayCount } from "@/lib/brand-share-link"

/**
 * "Share with vendor" on a brand book (plan v11.2.1 Step 4 item 4): a name, an email and the recipient's country send
 * a link (never an attachment) through POST /api/admin/brands/[id]/shares, the same path as the send command. The
 * active and past shares are listed with their views, and an active one can be revoked.
 */
interface Share {
  id: string; state: "active" | "expired" | "revoked" | "failed"; versionId: string; recipientName: string; recipientEmail: string; recipientCountry: string
  senderEmail: string; via: "button" | "command"; createdAt: string; expiresAt: string; revokedBy: string | null; revokedAt: string | null
  views: number; lastViewedAt: string | null
}
interface Shares { shares: Share[]; left: number; cap: number; defaultDays: number; maxDays: number }

const STATE_LABEL: Record<Share["state"], string> = { active: "Active", expired: "Expired", revoked: "Revoked", failed: "Not sent" }
const STATE_TONE: Record<Share["state"], string> = { active: "text-emerald-700", expired: "text-neutral-500", revoked: "text-neutral-500", failed: "text-red-600" }
const day = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
const when = (iso: string) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""

export function BrandShares({ brandId, brand, versionId }: { brandId: string; brand: string; versionId: string }) {
  const [data, setData] = useState<Shares | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", country: "United States", days: "" })
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  // The send command (Step 4 item 5) opens this page with the share in the fragment (#share&email=…), which never
  // reaches a server or a log; the requester checks it and presses Send link, signed in, through the same route.
  const [via, setVia] = useState<"button" | "command">("button")
  // Read on load, and again when a second command link opens in a tab already on this page (only the fragment changes).
  useEffect(() => {
    const fill = () => {
      const p = commandPrefill(window.location.hash)
      if (!p) return
      setForm(f => ({ name: p.name ?? f.name, email: p.email ?? f.email, country: p.country ?? f.country, days: p.days ?? f.days }))
      setVia("command"); setResult(null)
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      document.getElementById("share-with-vendor")?.scrollIntoView({ block: "center" })
    }
    fill()
    window.addEventListener("hashchange", fill)
    return () => window.removeEventListener("hashchange", fill)
  }, [])
  const countries = useMemo(() => {
    const dn = new Intl.DisplayNames(["en"], { type: "region" }), out: string[] = []
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      try { const n = Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}` ? dn.of(code) : undefined; if (n && n !== code && !/unknown/i.test(n)) out.push(n) } catch { /* not a region */ }
    }
    return [...new Set(out)].sort()
  }, [])

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/brands/${encodeURIComponent(brandId)}/shares`, { cache: "no-store" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Could not read the shares")
      setData(d as Shares); setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the shares") }
  }, [brandId])
  useEffect(() => { load() }, [load])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const days = form.days ? Number(form.days) : undefined
    if (!window.confirm(`Send the ${brand} brand book (${versionId}) to ${form.email}? The link works for ${dayCount(days ?? data?.defaultDays ?? 14)}.`)) return
    setBusy("send"); setResult(null)
    try {
      const r = await fetch(`/api/admin/brands/${encodeURIComponent(brandId)}/shares`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, country: form.country, ...(days ? { expiresDays: days } : {}), via }) })
      const d = await r.json()
      if (!r.ok) { setResult({ ok: false, message: d.error || "The share was not sent" }); return }
      setResult({ ok: true, message: `Sent to ${d.share.recipientEmail}. The link works until ${day(d.share.expiresAt)}.` })
      setForm(f => ({ ...f, name: "", email: "" })); setVia("button")
    } catch { setResult({ ok: false, message: "The share was not sent" }) }
    finally { setBusy(null); load() }
  }
  async function revoke(s: Share) {
    if (!window.confirm(`Revoke the link sent to ${s.recipientEmail}? It stops opening at once.`)) return
    setBusy(s.id); setResult(null)
    try {
      const r = await fetch(`/api/admin/brands/${encodeURIComponent(brandId)}/shares/${s.id}/revoke`, { method: "POST" })
      const d = await r.json()
      setResult(r.ok ? { ok: true, message: `Revoked the link sent to ${s.recipientEmail}.` } : { ok: false, message: d.error || "Could not revoke" })
    } finally { setBusy(null); load() }
  }

  const input = "h-8 w-full rounded border border-neutral-300 bg-white px-2 text-sm"
  return (
    <div className="space-y-4 text-sm">
      {via === "command" && <p id="share-with-vendor" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Filled in by the send command. Check the recipient, country and days, then press Send link. Nothing is sent until you do.</p>}
      <form onSubmit={send} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_5rem_auto] sm:items-end">
        <label className="text-xs text-neutral-500">Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={100} className={input} placeholder="Optional" /></label>
        <label className="text-xs text-neutral-500">Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={input} /></label>
        <label className="text-xs text-neutral-500">Country<input required list="share-countries" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={input} /></label>
        <label className="text-xs text-neutral-500">Days<input type="number" min={1} max={data?.maxDays ?? 30} value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} placeholder={String(data?.defaultDays ?? 14)} className={input} /></label>
        <button type="submit" disabled={!!busy || data?.left === 0} className="inline-flex h-8 items-center justify-center gap-1.5 rounded bg-neutral-900 px-3 text-white hover:bg-neutral-800 disabled:opacity-40">
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send link
        </button>
        <datalist id="share-countries">{countries.map(c => <option key={c} value={c} />)}</datalist>
      </form>
      <p className="text-xs text-neutral-500">
        The email carries a link, not a file: it opens this book as version {versionId}, with a Download PDF. The designer gets the brand book above, nothing from Internal. Recipients in excluded jurisdictions and suppressed addresses are refused.
        {data && <> You can send {data.left} more today (limit {data.cap}).</>}
      </p>
      {result && <p className={result.ok ? "text-emerald-700" : "text-red-600"}>{result.message}</p>}
      {error && <p className="text-red-600">{error}</p>}
      {data && data.shares.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-neutral-500"><th className="py-1 pr-3 font-medium">Recipient</th><th className="py-1 pr-3 font-medium">Sent</th><th className="py-1 pr-3 font-medium">Status</th><th className="py-1 pr-3 font-medium">Views</th><th className="py-1 font-medium"></th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.shares.map(s => (
                <tr key={s.id} className="align-top">
                  <td className="py-1.5 pr-3">{s.recipientName && <span className="text-neutral-900">{s.recipientName} </span>}<span className="text-neutral-600">{s.recipientEmail}</span> <span className="text-neutral-400">{s.recipientCountry}</span></td>
                  <td className="py-1.5 pr-3 text-neutral-600">{when(s.createdAt)} by {s.senderEmail}{s.via === "command" ? " (command)" : ""} · <span className="font-mono">{s.versionId}</span></td>
                  <td className={`py-1.5 pr-3 ${STATE_TONE[s.state]}`}>{STATE_LABEL[s.state]}{s.state === "active" ? ` until ${day(s.expiresAt)}` : s.state === "revoked" && s.revokedBy ? ` by ${s.revokedBy}` : ""}</td>
                  <td className="py-1.5 pr-3 text-neutral-600">{s.views}{s.lastViewedAt ? `, last ${when(s.lastViewedAt)}` : ""}</td>
                  <td className="py-1.5 text-right">
                    {s.state === "active" && <button onClick={() => revoke(s)} disabled={!!busy} className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded border border-neutral-300 bg-white px-2 hover:bg-neutral-50 disabled:opacity-40">
                      {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Revoke
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


"use client"

import { useState, useEffect } from "react"
import type { Lead, LeadStatus } from "@/app/types/lead-types"

interface ScrapeFormState {
  query: string
  urls: string
  industry: string
  location: string
}

export default function WebScraperAdminPage() {
  const [form, setForm] = useState<ScrapeFormState>({ query: "", urls: "", industry: "", location: "" })
  const [status, setStatus] = useState<"idle" | "running" | "complete" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [airtableStatus, setAirtableStatus] = useState<string>("")
  const [airtableLoading, setAirtableLoading] = useState<boolean>(false)

  async function fetchLeads() {
    try {
      const params = new URLSearchParams()
      if (filter) params.set("search", filter)
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let data: any = {}
      try { data = await res.json() } catch { data = {} }
      setLeads(Array.isArray(data.leads) ? data.leads : [])
    } catch (err) {
      console.error('fetchLeads error', err)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [filter, statusFilter])

  async function runScraper() {
    setStatus("running")
    setStatusMessage("Starting scraper...")
    try {
      const urlsArray = form.urls.split(/\n|,/).map(u => u.trim()).filter(Boolean)
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: form.query, urls: urlsArray, industry: form.industry, location: form.location }),
      })
      let data: any = {}
      try { data = await res.json() } catch { /* ignore body parse */ }
      if (!res.ok) throw new Error(data.error || "Scrape failed")
      setStatus("complete")
      const ts = new Date().toLocaleTimeString()
      setCompletedAt(ts)
      setStatusMessage(`Completed at ${ts}. New leads: ${data.newLeads ?? 0}`)
      fetchLeads()
    } catch (e: any) {
      setStatus("error")
      setStatusMessage(e.message)
    }
  }

  async function exportCsv() {
    const res = await fetch("/api/leads?export=csv")
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `leads-${Date.now()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  function openLead(lead: Lead) {
    setSelectedLead(lead)
    setShowModal(true)
  }

  async function updateLeadStatus(id: string, status: LeadStatus) {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    fetchLeads()
  }

  async function saveLeadToAirtable(id: string) {
    setAirtableLoading(true)
    setAirtableStatus('Saving...')
    try {
      const res = await fetch(`/api/airtable/leads/${id}`, { method: 'POST' })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAirtableStatus(`Saved (${data.action})`)
    } catch (e: any) {
      setAirtableStatus(`Error: ${e.message}`)
    } finally { setAirtableLoading(false); setTimeout(()=> setAirtableStatus(''), 4000) }
  }

  async function bulkExport() {
    setAirtableLoading(true)
    setAirtableStatus('Bulk saving...')
    try {
      const res = await fetch('/api/airtable/leads/bulk', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ status: 'new', limit: 20 }) })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAirtableStatus(`Bulk saved ${data.count} leads`)
    } catch (e: any) {
      setAirtableStatus(`Error: ${e.message}`)
    } finally { setAirtableLoading(false); setTimeout(()=> setAirtableStatus(''), 5000) }
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-32">
      <h1 className="text-5xl font-ggx88 mb-8">Sales Lead Scraper</h1>
      <p className="text-gray-400 max-w-2xl mb-10 text-sm leading-relaxed">
        Paste one or more company homepage URLs and click Run Scraper. Then open a lead and click "Save to Airtable" to sync it.
      </p>

      {/* Scrape Section */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mb-10 border border-gray-700/50">
        <h2 className="text-2xl font-semibold mb-4">Scrape</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Search Query (optional)</label>
            <input value={form.query} onChange={e=>setForm(f=>({...f, query:e.target.value}))} placeholder="(Future feature)" className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Industry (optional)</label>
            <input value={form.industry} onChange={e=>setForm(f=>({...f, industry:e.target.value}))} placeholder="FinTech" className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Location (optional)</label>
            <input value={form.location} onChange={e=>setForm(f=>({...f, location:e.target.value}))} placeholder="San Antonio" className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Company URLs (one per line)</label>
            <textarea value={form.urls} onChange={e=>setForm(f=>({...f, urls:e.target.value}))} rows={3} placeholder="https://company-homepage.com" className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={runScraper} disabled={status === "running"} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 rounded-lg text-sm font-medium">{status === "running" ? "Running..." : "Run Scraper"}</button>
          <span className="text-sm text-gray-400">
            Status: {status === "idle" && "Idle"}{status === "running" && "Running..."}{status === "complete" && statusMessage}{status === "error" && `Error: ${statusMessage}`}
          </span>
          <button onClick={bulkExport} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm" disabled={airtableLoading}>Bulk Save New to Airtable</button>
          {airtableStatus && <span className="text-xs text-gray-500">{airtableStatus}</span>}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <h2 className="text-2xl font-semibold flex-1">Leads</h2>
          <input placeholder="Search leads" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value as any)} className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={exportCsv} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">Export CSV</button>
        </div>
        <div className="overflow-auto rounded-lg border border-gray-700/50">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800/50">
              <tr className="text-left">
                {['Company Name','Industry','Location','Contact','Title','Email','Phone','Status','Actions'].map(h=> <th key={h} className="px-3 py-2 font-medium text-gray-300 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-t border-gray-700/40 hover:bg-gray-800/50 cursor-pointer" onClick={()=> openLead(lead)}>
                  <td className="px-3 py-2 font-medium text-white">{lead.company_name}</td>
                  <td className="px-3 py-2 text-gray-300">{lead.industry || '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{lead.location || '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{lead.contact_name || '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{(lead as any).contact_title || '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{lead.email || '-'}</td>
                  <td className="px-3 py-2 text-gray-300">{lead.phone || '-'}</td>
                  <td className="px-3 py-2">
                    <select value={lead.status} onClick={e=> e.stopPropagation()} onChange={e=> updateLeadStatus(lead.id, e.target.value as LeadStatus)} className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs">
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-3 py-2"><button onClick={(e)=> {e.stopPropagation(); openLead(lead)}} className="text-purple-400 hover:text-purple-300 text-xs">View</button></td>
                </tr>
              ))}
              {!leads.length && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No leads yet. Run a scrape to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={()=> setShowModal(false)}>
          <div className="bg-gray-900 w-full max-w-lg rounded-xl p-6 border border-gray-700/50" onClick={e=> e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold">Lead Details</h3>
              <button onClick={()=> setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Company', selectedLead.company_name],
                ['Website', selectedLead.website_url],
                ['Industry', selectedLead.industry],
                ['Location', selectedLead.location],
                ['Contact', selectedLead.contact_name],
                ['Title', (selectedLead as any).contact_title],
                ['Email', selectedLead.email],
                ['Phone', selectedLead.phone],
                ['Status', selectedLead.status],
                ['Source URL', selectedLead.source_url],
              ].map(([label,value]) => (
                <div key={label} className="flex gap-3">
                  <div className="w-28 text-gray-500">{label}</div>
                  <div className="flex-1 text-gray-200 break-all">{value || '-'} </div>
                </div>
              ))}
              <div>
                <div className="w-28 text-gray-500 mb-1">Notes</div>
                <textarea defaultValue={selectedLead.notes} onBlur={async e=> { await fetch(`/api/leads/${selectedLead.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes: e.target.value }) }); fetchLeads() }} rows={4} className="w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm" />
              </div>
              <div className="pt-2 flex gap-3">
                <button onClick={()=> saveLeadToAirtable(selectedLead.id)} disabled={airtableLoading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4 py-2 rounded text-xs font-medium">{airtableLoading ? 'Saving...' : 'Save to Airtable'}</button>
                {airtableStatus && <span className="text-xs text-gray-500 self-center">{airtableStatus}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

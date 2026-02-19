"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Mail,
  Phone,
  Globe,
  Mic2,
  Trash2,
  Edit2,
  Eye,
  X,
  Loader2,
  ExternalLink,
  DollarSign,
  Star,
} from "lucide-react"
import type { Speaker } from "@/types/project-management-types"

interface SpeakersSectionProps {
  speakers: Speaker[]
  onDelete: (id: string) => void
  onSave: (speaker: Partial<Speaker>, isNew: boolean) => Promise<void>
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

type SortField = "name" | "company" | "title" | "speaking_fee"
type SortDir = "asc" | "desc"
type ViewLayout = "table" | "grid"

export default function SpeakersSection({ speakers, onDelete, onSave, showToast }: SpeakersSectionProps) {
  const [layout, setLayout] = useState<ViewLayout>("table")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  // Modal states
  const [formOpen, setFormOpen] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [detailSpeaker, setDetailSpeaker] = useState<Speaker | null>(null)

  const processedData = useMemo(() => {
    let filtered = speakers
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.company?.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.topics?.some((t) => t.toLowerCase().includes(q))
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""
      switch (sortField) {
        case "name": aVal = a.name?.toLowerCase() || ""; bVal = b.name?.toLowerCase() || ""; break
        case "company": aVal = a.company?.toLowerCase() || ""; bVal = b.company?.toLowerCase() || ""; break
        case "title": aVal = a.title?.toLowerCase() || ""; bVal = b.title?.toLowerCase() || ""; break
        case "speaking_fee": aVal = a.speaking_fee || 0; bVal = b.speaking_fee || 0; break
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }, [speakers, searchQuery, sortField, sortDir])

  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-300" />
    return sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-neutral-900" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-900" />
  }

  return (
    <>
      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search speakers by name, company, topic..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <button onClick={() => setLayout("table")} className={`p-2.5 transition-colors ${layout === "table" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700"}`} title="Table view">
                <LayoutList className="w-4 h-4" />
              </button>
              <button onClick={() => setLayout("grid")} className={`p-2.5 transition-colors ${layout === "grid" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700"}`} title="Grid view">
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { setEditingSpeaker(null); setFormOpen(true) }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Speaker
            </button>
          </div>
        </div>

        <div className="text-sm text-neutral-500">
          Showing <strong className="text-neutral-900">{paginatedData.length}</strong> of{" "}
          <strong className="text-neutral-900">{processedData.length}</strong> speakers
        </div>
      </div>

      {/* Table View */}
      {layout === "table" ? (
        <div className="mt-4 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {([
                    { field: "name" as SortField, label: "Name" },
                    { field: "title" as SortField, label: "Title" },
                    { field: "company" as SortField, label: "Company" },
                    { field: "speaking_fee" as SortField, label: "Fee" },
                  ]).map((col) => (
                    <th key={col.field} onClick={() => toggleSort(col.field)} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-900 select-none">
                      <span className="inline-flex items-center gap-1.5">{col.label}<SortIcon field={col.field} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Topics</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Mic2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-neutral-500 font-medium">No speakers found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((speaker) => (
                    <tr key={speaker.id} className="hover:bg-neutral-50 transition-colors group">
                      <td className="px-4 py-3">
                        <button onClick={() => setDetailSpeaker(speaker)} className="text-left">
                          <div className="flex items-center gap-3">
                            {(speaker.photo || speaker.headshot) ? (
                              <img src={speaker.photo || speaker.headshot} alt={speaker.name} className="w-8 h-8 rounded-full object-cover border border-neutral-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-50 to-purple-50 border border-neutral-200 flex items-center justify-center">
                                <span className="text-xs font-bold text-neutral-400">{speaker.name?.charAt(0) || "S"}</span>
                              </div>
                            )}
                            <span className="font-semibold text-neutral-900 hover:underline">{speaker.name}</span>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 truncate max-w-40">{speaker.title || "—"}</td>
                      <td className="px-4 py-3 text-neutral-600 truncate max-w-35">{speaker.company || "—"}</td>
                      <td className="px-4 py-3">
                        {speaker.speaking_fee ? (
                          <span className="font-semibold text-emerald-700">${speaker.speaking_fee.toLocaleString()}</span>
                        ) : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {speaker.topics && speaker.topics.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {speaker.topics.slice(0, 2).map((t, i) => (
                              <span key={i} className="px-2 py-0.5 text-[10px] font-medium text-neutral-600 bg-neutral-100 rounded">{t}</span>
                            ))}
                            {speaker.topics.length > 2 && <span className="text-[10px] text-neutral-400">+{speaker.topics.length - 2}</span>}
                          </div>
                        ) : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {speaker.email && <a href={`mailto:${speaker.email}`} className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"><Mail className="w-3.5 h-3.5" /></a>}
                          {(speaker.linkedin_url || speaker.linkedin) && <a href={speaker.linkedin_url || speaker.linkedin} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailSpeaker(speaker)} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => { setEditingSpeaker(speaker); setFormOpen(true) }} className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => onDelete(speaker.id)} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="mt-4">
          {paginatedData.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
              <Mic2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No speakers found</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedData.map((speaker) => (
                <div key={speaker.id} className="group relative overflow-hidden border border-neutral-200 bg-white hover:border-neutral-400 rounded-xl transition-all shadow-sm">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {(speaker.photo || speaker.headshot) ? (
                        <img src={speaker.photo || speaker.headshot} alt={speaker.name} className="w-12 h-12 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-50 to-purple-50 flex items-center justify-center border border-neutral-200">
                          <span className="text-lg font-bold text-neutral-300">{speaker.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setDetailSpeaker(speaker)} className="text-left">
                          <h3 className="text-sm font-bold text-neutral-900 hover:underline leading-tight">{speaker.name}</h3>
                        </button>
                        {speaker.title && <p className="text-xs text-neutral-600 truncate">{speaker.title}</p>}
                        {speaker.company && <p className="text-xs text-neutral-400">{speaker.company}</p>}
                      </div>
                    </div>

                    {speaker.topics && speaker.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {speaker.topics.slice(0, 3).map((t, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] font-medium text-neutral-600 bg-neutral-100 rounded">{t}</span>
                        ))}
                        {speaker.topics.length > 3 && <span className="text-[10px] text-neutral-400">+{speaker.topics.length - 3}</span>}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-neutral-100">
                      {speaker.email && <a href={`mailto:${speaker.email}`} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Mail className="w-3.5 h-3.5" /></a>}
                      {(speaker.linkedin_url || speaker.linkedin) && <a href={speaker.linkedin_url || speaker.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      <div className="flex-1" />
                      {speaker.speaking_fee && <span className="text-sm font-semibold text-emerald-600">${speaker.speaking_fee.toLocaleString()}</span>}
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingSpeaker(speaker); setFormOpen(true) }} className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 bg-white/80 backdrop-blur rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete(speaker.id)} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 bg-white/80 backdrop-blur rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page <strong className="text-neutral-900">{currentPage}</strong> of <strong className="text-neutral-900">{totalPages}</strong>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">First</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) pageNum = i + 1
              else if (currentPage <= 3) pageNum = i + 1
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
              else pageNum = currentPage - 2 + i
              return (
                <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${currentPage === pageNum ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"}`}>{pageNum}</button>
              )
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Last</button>
          </div>
        </div>
      )}

      {/* Speaker Form Modal */}
      <SpeakerFormModal
        isOpen={formOpen}
        speaker={editingSpeaker}
        onClose={() => { setFormOpen(false); setEditingSpeaker(null) }}
        onSave={async (data) => {
          await onSave(data, !editingSpeaker)
          setFormOpen(false)
          setEditingSpeaker(null)
        }}
      />

      {/* Speaker Detail Slideout */}
      <SpeakerDetailSlideout
        speaker={detailSpeaker}
        onClose={() => setDetailSpeaker(null)}
        onEdit={(s) => { setDetailSpeaker(null); setEditingSpeaker(s); setFormOpen(true) }}
        onDelete={(id) => { setDetailSpeaker(null); onDelete(id) }}
      />
    </>
  )
}

// ============================================
// Speaker Form Modal (inline)
// ============================================
function SpeakerFormModal({ isOpen, speaker, onClose, onSave }: {
  isOpen: boolean
  speaker: Speaker | null
  onClose: () => void
  onSave: (data: Partial<Speaker>) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", title: "", company: "", bio: "", email: "", phone: "",
    website: "", linkedin: "", twitter: "", instagram: "",
    headshot: "", topics: "", speaking_fee: "", travel_requirements: "",
    availability: "", notes: "",
  })

  const isEditing = !!speaker

  useState(() => {
    if (speaker) {
      setForm({
        name: speaker.name || "", title: speaker.title || "", company: speaker.company || "",
        bio: speaker.bio || "", email: speaker.email || "", phone: speaker.phone || "",
        website: speaker.website || "", linkedin: speaker.linkedin || speaker.linkedin_url || "",
        twitter: speaker.twitter || "", instagram: speaker.instagram || "",
        headshot: speaker.headshot || speaker.photo || "",
        topics: speaker.topics?.join(", ") || "", speaking_fee: speaker.speaking_fee?.toString() || "",
        travel_requirements: speaker.travel_requirements || "", availability: speaker.availability || "",
        notes: speaker.notes || "",
      })
    } else {
      setForm({
        name: "", title: "", company: "", bio: "", email: "", phone: "",
        website: "", linkedin: "", twitter: "", instagram: "",
        headshot: "", topics: "", speaking_fee: "", travel_requirements: "",
        availability: "", notes: "",
      })
    }
  })

  // Re-sync form when speaker prop changes
  const prevSpeakerId = useState<string | null>(null)
  if ((speaker?.id || null) !== prevSpeakerId[0]) {
    prevSpeakerId[1](speaker?.id || null)
    if (speaker) {
      setForm({
        name: speaker.name || "", title: speaker.title || "", company: speaker.company || "",
        bio: speaker.bio || "", email: speaker.email || "", phone: speaker.phone || "",
        website: speaker.website || "", linkedin: speaker.linkedin || speaker.linkedin_url || "",
        twitter: speaker.twitter || "", instagram: speaker.instagram || "",
        headshot: speaker.headshot || speaker.photo || "",
        topics: speaker.topics?.join(", ") || "", speaking_fee: speaker.speaking_fee?.toString() || "",
        travel_requirements: speaker.travel_requirements || "", availability: speaker.availability || "",
        notes: speaker.notes || "",
      })
    } else {
      setForm({
        name: "", title: "", company: "", bio: "", email: "", phone: "",
        website: "", linkedin: "", twitter: "", instagram: "",
        headshot: "", topics: "", speaking_fee: "", travel_requirements: "",
        availability: "", notes: "",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data: Partial<Speaker> = {
        ...(isEditing && speaker ? { id: speaker.id } : {}),
        name: form.name.trim(),
        title: form.title.trim() || undefined,
        company: form.company.trim() || undefined,
        bio: form.bio.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        linkedin: form.linkedin.trim() || undefined,
        twitter: form.twitter.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        headshot: form.headshot.trim() || undefined,
        topics: form.topics ? form.topics.split(",").map(t => t.trim()).filter(Boolean) : undefined,
        speaking_fee: form.speaking_fee ? Number(form.speaking_fee) : undefined,
        travel_requirements: form.travel_requirements.trim() || undefined,
        availability: form.availability.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-400"

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div>
                <div className="w-8 h-1 bg-yellow-400 mb-2" />
                <h2 className="text-xl font-bold text-neutral-900">{isEditing ? "Edit Speaker" : "Add New Speaker"}</h2>
              </div>
              <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Basic Information</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Name <span className="text-red-500">*</span></label>
                    <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Speaker name" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
                    <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Job title" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Company</label>
                    <input type="text" value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Speaking Fee ($)</label>
                    <input type="text" value={form.speaking_fee} onChange={(e) => setForm(f => ({ ...f, speaking_fee: e.target.value }))} placeholder="0.00" className={inputClass} />
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Contact</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Website</label><input type="url" value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">LinkedIn</label><input type="text" value={form.linkedin} onChange={(e) => setForm(f => ({ ...f, linkedin: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Twitter</label><input type="text" value={form.twitter} onChange={(e) => setForm(f => ({ ...f, twitter: e.target.value }))} className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Instagram</label><input type="text" value={form.instagram} onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))} className={inputClass} /></div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Details</legend>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Topics <span className="text-neutral-400">(comma-separated)</span></label><input type="text" value={form.topics} onChange={(e) => setForm(f => ({ ...f, topics: e.target.value }))} placeholder="AI, Marketing, Leadership" className={inputClass} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Bio</label><textarea value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} className={inputClass + " resize-none"} /></div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Headshot URL</label><input type="url" value={form.headshot} onChange={(e) => setForm(f => ({ ...f, headshot: e.target.value }))} className={inputClass} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-neutral-700 mb-1">Travel Requirements</label><input type="text" value={form.travel_requirements} onChange={(e) => setForm(f => ({ ...f, travel_requirements: e.target.value }))} className={inputClass} /></div>
                    <div><label className="block text-sm font-medium text-neutral-700 mb-1">Availability</label><input type="text" value={form.availability} onChange={(e) => setForm(f => ({ ...f, availability: e.target.value }))} className={inputClass} /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputClass + " resize-none"} /></div>
                </div>
              </fieldset>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 shadow-sm">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Speaker"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================
// Speaker Detail Slideout (inline)
// ============================================
function SpeakerDetailSlideout({ speaker, onClose, onEdit, onDelete }: {
  speaker: Speaker | null
  onClose: () => void
  onEdit: (speaker: Speaker) => void
  onDelete: (id: string) => void
}) {
  return (
    <AnimatePresence>
      {speaker && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="relative">
              {(speaker.photo || speaker.headshot) ? (
                <div className="relative h-48 bg-neutral-100 overflow-hidden">
                  <img src={speaker.photo || speaker.headshot} alt={speaker.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                </div>
              ) : (
                <div className="h-32 bg-linear-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                  <span className="text-5xl font-bold text-neutral-300">{speaker.name?.charAt(0)}</span>
                </div>
              )}
              <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-neutral-700 hover:bg-white rounded-lg transition-colors shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="w-10 h-1 bg-yellow-400 mb-3" />
                <h2 className="text-2xl font-bold text-neutral-900">{speaker.name}</h2>
                {speaker.title && <p className="text-base text-neutral-600 font-medium mt-1">{speaker.title}</p>}
                {speaker.company && <p className="text-sm text-neutral-400 mt-0.5">{speaker.company}</p>}
              </div>

              {speaker.speaking_fee && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span className="text-2xl font-bold text-emerald-700">${speaker.speaking_fee.toLocaleString()}</span>
                    <span className="text-sm text-emerald-600">speaking fee</span>
                  </div>
                </div>
              )}

              {speaker.topics && speaker.topics.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Topics</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {speaker.topics.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-lg">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {speaker.bio && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Bio</h4>
                  <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{speaker.bio}</p>
                </div>
              )}

              {/* Contact */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Contact</h4>
                <div className="space-y-3">
                  {speaker.email && (
                    <a href={`mailto:${speaker.email}`} className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group">
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors"><Mail className="w-4 h-4 text-neutral-500" /></div>
                      <span>{speaker.email}</span>
                    </a>
                  )}
                  {speaker.phone && (
                    <a href={`tel:${speaker.phone}`} className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group">
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors"><Phone className="w-4 h-4 text-neutral-500" /></div>
                      <span>{speaker.phone}</span>
                    </a>
                  )}
                  {(speaker.linkedin_url || speaker.linkedin) && (
                    <a href={speaker.linkedin_url || speaker.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group">
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors"><ExternalLink className="w-4 h-4 text-neutral-500" /></div>
                      <span>LinkedIn</span>
                    </a>
                  )}
                </div>
              </div>

              {(speaker.travel_requirements || speaker.availability) && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Logistics</h4>
                  {speaker.travel_requirements && <p className="text-sm text-neutral-600 mb-1"><strong>Travel:</strong> {speaker.travel_requirements}</p>}
                  {speaker.availability && <p className="text-sm text-neutral-600"><strong>Availability:</strong> {speaker.availability}</p>}
                </div>
              )}

              {speaker.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Notes</h4>
                  <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap p-4 bg-neutral-50 rounded-xl border border-neutral-100">{speaker.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
                <button onClick={() => onEdit(speaker)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" /> Edit Speaker
                </button>
                <button onClick={() => onDelete(speaker.id)} className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

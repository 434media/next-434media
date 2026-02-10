"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Loader2,
  Download,
  Mail,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  Calendar,
  FileDown,
  Trash2,
  Globe,
  Users,
  Database,
  MessageSquare,
} from "lucide-react"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"

// ── Types ──

interface EmailSignup {
  id: string
  email: string
  source: string
  created_at: string
}

interface ContactFormSubmission {
  id: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string
  created_at: string
}

interface Toast {
  message: string
  type: "success" | "error"
}

type ActiveTab = "emails" | "contact-forms"

// ── Main Component ──

export default function EmailListsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("contact-forms")
  const [toast, setToast] = useState<Toast | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-dvh bg-neutral-50 text-neutral-900 pt-20 md:pt-16">
        {/* Toast */}
        {toast && (
          <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
                toast.type === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 hover:opacity-80 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 transition-colors text-sm font-medium tracking-wide"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Admin
                </Link>
                <div className="h-5 w-px bg-neutral-200 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2">
                  <Mail className="w-4 h-4 text-neutral-600" />
                  <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                    EMAIL & CONTACT DATA
                  </h1>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex gap-0 -mb-px">
              <button
                onClick={() => setActiveTab("emails")}
                className={`relative px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors ${
                  activeTab === "emails"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Email Lists
                </span>
                {activeTab === "emails" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("contact-forms")}
                className={`relative px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors ${
                  activeTab === "contact-forms"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Contact Forms
                </span>
                {activeTab === "contact-forms" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
            </nav>
          </div>
        </header>

        {/* Tab Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === "emails" ? (
            <EmailListsTab setToast={setToast} />
          ) : (
            <ContactFormsTab setToast={setToast} />
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}

// ── Email Lists Tab ──

function EmailListsTab({
  setToast,
}: {
  setToast: (t: Toast | null) => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signups, setSignups] = useState<EmailSignup[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedSource, setSelectedSource] = useState<string>("AIM")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [datePreset, setDatePreset] = useState("")
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const fetchSourcesAndCounts = useCallback(async () => {
    try {
      const [sourcesRes, countsRes] = await Promise.all([
        fetch("/api/admin/email-lists-firestore?action=sources"),
        fetch("/api/admin/email-lists-firestore?action=counts"),
      ])
      const sourcesData = await sourcesRes.json()
      const countsData = await countsRes.json()
      if (sourcesData.success) setSources(sourcesData.sources)
      if (countsData.success) setCounts(countsData.counts)
    } catch (err) {
      console.error("Error fetching sources:", err)
    }
  }, [])

  const fetchSignups = useCallback(
    async (source?: string) => {
      try {
        setIsLoading(true)
        setError(null)
        const url = source
          ? `/api/admin/email-lists-firestore?source=${encodeURIComponent(source)}`
          : "/api/admin/email-lists-firestore"
        const res = await fetch(url)
        const data = await res.json()
        if (data.success) {
          setSignups(data.signups)
        } else {
          setError(data.error || "Failed to fetch signups")
        }
      } catch {
        setError("Failed to fetch email signups")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchSourcesAndCounts()
  }, [fetchSourcesAndCounts])

  useEffect(() => {
    if (selectedSource) fetchSignups(selectedSource)
  }, [selectedSource, fetchSignups])

  const handleDeleteEmail = async (id: string, email: string) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/email-lists-firestore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted ${email}`, type: "success" })
        await fetchSourcesAndCounts()
        await fetchSignups(selectedSource)
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete email", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDownloadAllCSV = async () => {
    try {
      setIsDownloading(true)
      const url = selectedSource
        ? `/api/admin/email-lists-firestore?source=${encodeURIComponent(selectedSource)}&format=csv`
        : "/api/admin/email-lists-firestore?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `${selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"}-emails-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${counts[selectedSource] || signups.length} emails`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDownloadFilteredCSV = () => {
    try {
      const headers = ["Email", "Source", "Signup Date"]
      const rows = filteredSignups.map((signup) => [
        signup.email,
        signup.source,
        signup.created_at ? new Date(signup.created_at).toLocaleDateString() : "",
      ])
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const escaped = String(cell).replace(/"/g, '""')
              return escaped.includes(",") || escaped.includes('"')
                ? `"${escaped}"`
                : escaped
            })
            .join(",")
        ),
      ].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv" })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      let filename = selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"
      filename += "-emails"
      if (startDate && endDate) filename += `-${startDate}-to-${endDate}`
      else if (startDate) filename += `-from-${startDate}`
      else if (endDate) filename += `-until-${endDate}`
      else filename += `-${new Date().toISOString().split("T")[0]}`
      a.download = `${filename}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${filteredSignups.length} emails`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Filter signups
  const filteredSignups = signups.filter((signup) => {
    if (searchQuery && !signup.email.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (startDate || endDate) {
      const signupDate = new Date(signup.created_at)
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        if (signupDate < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        if (signupDate > end) return false
      }
    }
    return true
  })

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split("T")[0]
    switch (preset) {
      case "today":
        setStartDate(fmt(today))
        setEndDate(fmt(today))
        break
      case "yesterday": {
        const y = new Date(today)
        y.setDate(y.getDate() - 1)
        setStartDate(fmt(y))
        setEndDate(fmt(y))
        break
      }
      case "last7days": {
        const d = new Date(today)
        d.setDate(d.getDate() - 7)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "last30days": {
        const d = new Date(today)
        d.setDate(d.getDate() - 30)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "thisMonth": {
        const d = new Date(today.getFullYear(), today.getMonth(), 1)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "lastMonth": {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const last = new Date(today.getFullYear(), today.getMonth(), 0)
        setStartDate(fmt(first))
        setEndDate(fmt(last))
        break
      }
      case "thisYear": {
        const d = new Date(today.getFullYear(), 0, 1)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      default:
        setStartDate("")
        setEndDate("")
        break
    }
  }

  const totalCount = selectedSource
    ? counts[selectedSource] || 0
    : Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Email Lists
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Manage and export email signups from all 434 MEDIA websites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSignups(selectedSource)}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleDownloadAllCSV}
            disabled={isDownloading || totalCount === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Export All</span>
          </button>
        </div>
      </div>

      {/* Source Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6">
        {Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([source, count]) => (
            <button
              key={source}
              onClick={() => setSelectedSource(source)}
              className={`p-3 rounded-xl border transition-all text-left ${
                selectedSource === source
                  ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                  : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3 h-3 opacity-50" />
                <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                  {source}
                </span>
              </div>
              <div className="text-xl font-bold leading-tight">{count.toLocaleString()}</div>
              <div className="text-[11px] opacity-50 font-normal leading-snug">emails</div>
            </button>
          ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-neutral-300 hidden sm:block" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white text-[13px] font-medium text-neutral-700"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source} ({counts[source] || 0})
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-700"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neutral-300 hidden sm:block" />
            <select
              value={datePreset}
              onChange={(e) => handleDatePreset(e.target.value)}
              className="px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white text-[13px] font-medium text-neutral-700"
            >
              <option value="">Date Range</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[12px] text-neutral-400 hidden sm:inline font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset("")
              }}
              className="flex-1 sm:flex-none px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white text-[13px] font-normal text-neutral-700"
            />
            <span className="text-[12px] text-neutral-400 font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset("")
              }}
              className="flex-1 sm:flex-none px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white text-[13px] font-normal text-neutral-700"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("")
                setEndDate("")
                setDatePreset("")
              }}
              className="px-3 py-1.5 text-[12px] text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 text-neutral-500">
          <Users className="w-4 h-4" />
          <span className="text-[13px] font-normal leading-snug">
            Showing <strong className="text-neutral-900 font-semibold">{filteredSignups.length.toLocaleString()}</strong>{" "}
            of <strong className="text-neutral-900 font-semibold">{totalCount.toLocaleString()}</strong> emails
            {selectedSource && (
              <>
                {" "}from <strong className="text-neutral-900 font-semibold">{selectedSource}</strong>
              </>
            )}
          </span>
          {(startDate || endDate) && (
            <span className="text-[11px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
              {startDate && endDate
                ? `${formatDate(startDate)} – ${formatDate(endDate)}`
                : startDate
                ? `From ${formatDate(startDate)}`
                : `Until ${formatDate(endDate)}`}
            </span>
          )}
        </div>
        {filteredSignups.length > 0 && (searchQuery || startDate || endDate) && (
          <button
            onClick={handleDownloadFilteredCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Download Filtered ({filteredSignups.length})
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchSignups(selectedSource)}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !error && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-400 text-[13px] font-normal">Loading email signups...</p>
        </div>
      )}

      {/* Email Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Email
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Source
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Date
                    </span>
                  </th>
                  <th className="text-right px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSignups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-neutral-400">
                      <Mail className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No email signups found</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSignups.map((signup) => (
                    <tr key={signup.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                          {signup.email}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide">
                          {signup.source}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-neutral-400 text-[12px] font-normal whitespace-nowrap">
                        {formatDate(signup.created_at)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteEmail(signup.id, signup.email)}
                          disabled={isDeleting === signup.id}
                          className="p-1.5 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title={`Delete ${signup.email}`}
                        >
                          {isDeleting === signup.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredSignups.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-normal">
                {filteredSignups.length} email{filteredSignups.length !== 1 ? "s" : ""} in table
              </span>
              <button
                onClick={handleDownloadFilteredCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Contact Forms Tab ──

function ContactFormsTab({
  setToast,
}: {
  setToast: (t: Toast | null) => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<ContactFormSubmission[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedSource, setSelectedSource] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationResults, setMigrationResults] = useState<{
    total: number
    migrated: number
    skipped: number
    errors: number
    details?: Record<string, { total: number; migrated: number; skipped: number; errors: number }>
  } | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchSourcesAndCounts = useCallback(async () => {
    try {
      const [sourcesRes, countsRes] = await Promise.all([
        fetch("/api/admin/contact-forms?action=sources"),
        fetch("/api/admin/contact-forms?action=counts"),
      ])
      const sourcesData = await sourcesRes.json()
      const countsData = await countsRes.json()
      if (sourcesData.success) setSources(sourcesData.sources)
      if (countsData.success) setCounts(countsData.counts)
    } catch (err) {
      console.error("Error fetching contact form sources:", err)
    }
  }, [])

  const fetchSubmissions = useCallback(async (source?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const url = source
        ? `/api/admin/contact-forms?source=${encodeURIComponent(source)}`
        : "/api/admin/contact-forms"
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setSubmissions(data.submissions)
      } else {
        setError(data.error || "Failed to fetch submissions")
      }
    } catch {
      setError("Failed to fetch contact form data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSourcesAndCounts()
    fetchSubmissions()
  }, [fetchSourcesAndCounts, fetchSubmissions])

  useEffect(() => {
    fetchSubmissions(selectedSource || undefined)
  }, [selectedSource, fetchSubmissions])

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete submission from ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/contact-forms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted submission from ${email}`, type: "success" })
        await fetchSourcesAndCounts()
        await fetchSubmissions(selectedSource || undefined)
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete submission", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleMigration = async () => {
    if (!confirm("Migrate contact form data from Airtable (434Form, AIMForm, VemosForm) to Firestore? Existing entries will be skipped.")) return
    try {
      setIsMigrating(true)
      setMigrationResults(null)
      const res = await fetch("/api/admin/contact-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "migrate" }),
      })
      const data = await res.json()
      if (data.success) {
        setMigrationResults(data.results)
        setToast({
          message: `Migration complete: ${data.results.migrated} forms migrated`,
          type: "success",
        })
        await fetchSourcesAndCounts()
        await fetchSubmissions(selectedSource || undefined)
      } else {
        setToast({ message: data.error || "Migration failed", type: "error" })
      }
    } catch {
      setToast({ message: "Migration failed", type: "error" })
    } finally {
      setIsMigrating(false)
    }
  }

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true)
      const url = selectedSource
        ? `/api/admin/contact-forms?source=${encodeURIComponent(selectedSource)}&format=csv`
        : "/api/admin/contact-forms?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `contact-forms-${selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${submissions.length} submissions`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredSubmissions = submissions.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.email.toLowerCase().includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.company.toLowerCase().includes(q) ||
      (s.message || "").toLowerCase().includes(q)
    )
  })

  const totalCount = selectedSource
    ? counts[selectedSource] || 0
    : Object.values(counts).reduce((a, b) => a + b, 0)

  const hasNoData = !isLoading && sources.length === 0 && submissions.length === 0

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Contact Form Submissions
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Form data from 434 Media, AIM, and Vemos Vamos websites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSubmissions(selectedSource || undefined)}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={isDownloading || totalCount === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Migration Section — shown when no data or explicitly needed */}
      {hasNoData && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-neutral-600" />
            <h3 className="text-[13px] font-semibold text-neutral-800 tracking-wide">
              Airtable → Firestore Migration
            </h3>
          </div>
          <p className="text-[12px] text-neutral-400 font-normal leading-relaxed mb-4">
            Migrate contact form submissions from Airtable (434Form, AIMForm, VemosForm) to Firestore.
            Duplicate entries are automatically skipped.
          </p>
          <button
            onClick={handleMigration}
            disabled={isMigrating}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isMigrating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Migrate Contact Forms
          </button>

          {migrationResults && (
            <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-[13px] font-semibold text-neutral-800">Migration Complete</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <div className="text-neutral-400 font-medium">Total</div>
                  <div className="text-neutral-900 font-bold text-lg leading-tight mt-0.5">
                    {migrationResults.total}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <div className="text-neutral-400 font-medium">Migrated</div>
                  <div className="text-green-600 font-bold text-lg leading-tight mt-0.5">
                    {migrationResults.migrated}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <div className="text-neutral-400 font-medium">Skipped</div>
                  <div className="text-amber-600 font-bold text-lg leading-tight mt-0.5">
                    {migrationResults.skipped}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                  <div className="text-neutral-400 font-medium">Errors</div>
                  <div className="text-red-600 font-bold text-lg leading-tight mt-0.5">
                    {migrationResults.errors}
                  </div>
                </div>
              </div>
              {migrationResults.details && (
                <div className="mt-3 space-y-1">
                  {Object.entries(migrationResults.details).map(([source, detail]) => (
                    <div key={source} className="text-[11px] text-neutral-500 font-normal">
                      <span className="font-semibold text-neutral-700">{source}:</span>{" "}
                      {detail.migrated} migrated, {detail.skipped} skipped
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Source Stats Cards */}
      {Object.keys(counts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          <button
            onClick={() => setSelectedSource("")}
            className={`p-3 rounded-xl border transition-all text-left ${
              selectedSource === ""
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Globe className="w-3 h-3 opacity-50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">All</span>
            </div>
            <div className="text-xl font-bold leading-tight">
              {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div className="text-[11px] opacity-50 font-normal leading-snug">submissions</div>
          </button>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`p-3 rounded-xl border transition-all text-left ${
                  selectedSource === source
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                    : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 opacity-50" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                    {source}
                  </span>
                </div>
                <div className="text-xl font-bold leading-tight">{count.toLocaleString()}</div>
                <div className="text-[11px] opacity-50 font-normal leading-snug">submissions</div>
              </button>
            ))}
        </div>
      )}

      {/* Search */}
      {submissions.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
            <input
              type="text"
              placeholder="Search by name, email, company, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-700"
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      {submissions.length > 0 && (
        <div className="flex items-center gap-2 text-neutral-500 mb-4">
          <Users className="w-4 h-4" />
          <span className="text-[13px] font-normal leading-snug">
            Showing{" "}
            <strong className="text-neutral-900 font-semibold">
              {filteredSubmissions.length.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="text-neutral-900 font-semibold">
              {totalCount.toLocaleString()}
            </strong>{" "}
            submissions
            {selectedSource && (
              <>
                {" "}from{" "}
                <strong className="text-neutral-900 font-semibold">{selectedSource}</strong>
              </>
            )}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchSubmissions(selectedSource || undefined)}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !error && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-400 text-[13px] font-normal">Loading contact form data...</p>
        </div>
      )}

      {/* Submissions Table */}
      {!isLoading && !error && submissions.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Name
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Email
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden md:table-cell">
                    Company
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Source
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden sm:table-cell">
                    Date
                  </th>
                  <th className="text-right px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-neutral-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No submissions found</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <Fragment key={sub.id}>
                      <tr
                        className="hover:bg-neutral-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === sub.id ? null : sub.id)}
                      >
                        <td className="px-4 sm:px-5 py-3">
                          <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                            {sub.firstName} {sub.lastName}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3">
                          <span className="text-neutral-600 text-[13px] font-normal leading-snug">
                            {sub.email}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 hidden md:table-cell">
                          <span className="text-neutral-500 text-[12px] font-normal">
                            {sub.company || "—"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide">
                            {sub.source}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-neutral-400 text-[12px] font-normal whitespace-nowrap hidden sm:table-cell">
                          {formatDate(sub.created_at)}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(sub.id, sub.email)
                            }}
                            disabled={isDeleting === sub.id}
                            className="p-1.5 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={`Delete ${sub.email}`}
                          >
                            {isDeleting === sub.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {/* Expanded row for message details */}
                      {expandedRow === sub.id && (
                        <tr className="bg-neutral-50">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                              {sub.phone && (
                                <div>
                                  <span className="text-neutral-400 font-semibold uppercase tracking-wide text-[10px]">
                                    Phone
                                  </span>
                                  <p className="text-neutral-700 font-normal leading-snug mt-0.5">
                                    {sub.phone}
                                  </p>
                                </div>
                              )}
                              <div>
                                <span className="text-neutral-400 font-semibold uppercase tracking-wide text-[10px]">
                                  Company
                                </span>
                                <p className="text-neutral-700 font-normal leading-snug mt-0.5">
                                  {sub.company || "N/A"}
                                </p>
                              </div>
                              <div>
                                <span className="text-neutral-400 font-semibold uppercase tracking-wide text-[10px]">
                                  Date
                                </span>
                                <p className="text-neutral-700 font-normal leading-snug mt-0.5">
                                  {formatDate(sub.created_at)}
                                </p>
                              </div>
                              {sub.message && (
                                <div className="sm:col-span-2">
                                  <span className="text-neutral-400 font-semibold uppercase tracking-wide text-[10px]">
                                    Message
                                  </span>
                                  <p className="text-neutral-700 font-normal leading-relaxed mt-0.5 whitespace-pre-wrap">
                                    {sub.message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredSubmissions.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-normal">
                {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? "s" : ""} in
                table
              </span>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

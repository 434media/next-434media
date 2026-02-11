"use client"

import { useState, useEffect, useCallback } from "react"
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
  X,
  Phone,
  Building2,
  User,
  Eye,
  Clock,
  Pencil,
  Save,
  Ticket,
  MapPin,
  Check,
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

interface EventRegistration {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  pageUrl: string
}

interface Toast {
  message: string
  type: "success" | "error"
}

type ActiveTab = "emails" | "contact-forms" | "events"

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
                    LEADS & REGISTRATIONS
                  </h1>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex gap-0 -mb-px">
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
              <button
                onClick={() => setActiveTab("events")}
                className={`relative px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors ${
                  activeTab === "events"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Ticket className="w-3.5 h-3.5" />
                  Events
                </span>
                {activeTab === "events" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
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
            </nav>
          </div>
        </header>

        {/* Tab Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === "contact-forms" ? (
            <ContactFormsTab setToast={setToast} />
          ) : activeTab === "events" ? (
            <EventRegistrationsTab setToast={setToast} />
          ) : (
            <EmailListsTab setToast={setToast} />
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
  const [selectedSubmission, setSelectedSubmission] = useState<ContactFormSubmission | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<ContactFormSubmission>>({})

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

  const handleUpdate = async () => {
    if (!selectedSubmission) return
    try {
      setIsSaving(true)
      const res = await fetch("/api/admin/contact-forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedSubmission.id, ...editForm }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: "Submission updated successfully", type: "success" })
        // Update in local state
        const updated = { ...selectedSubmission, ...editForm } as ContactFormSubmission
        setSelectedSubmission(updated)
        setSubmissions((prev) =>
          prev.map((s) => (s.id === selectedSubmission.id ? updated : s))
        )
        setIsEditing(false)
      } else {
        setToast({ message: data.error || "Failed to update", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to update submission", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = () => {
    if (!selectedSubmission) return
    setEditForm({
      firstName: selectedSubmission.firstName,
      lastName: selectedSubmission.lastName,
      email: selectedSubmission.email,
      phone: selectedSubmission.phone || "",
      company: selectedSubmission.company,
      message: selectedSubmission.message || "",
      source: selectedSubmission.source,
    })
    setIsEditing(true)
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
                    First Name
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Last Name
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Email
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Phone
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
                    <td colSpan={8} className="px-5 py-12 text-center text-neutral-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No submissions found</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                          {sub.firstName || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                          {sub.lastName || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-600 text-[13px] font-normal leading-snug">
                          {sub.email}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 hidden lg:table-cell">
                        <span className="text-neutral-500 text-[12px] font-normal">
                          {sub.phone || "—"}
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSubmission(sub)
                            }}
                            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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
                        </div>
                      </td>
                    </tr>
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

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setSelectedSubmission(null); setIsEditing(false) }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                  {(selectedSubmission.firstName?.[0] || "").toUpperCase()}
                  {(selectedSubmission.lastName?.[0] || "").toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-neutral-900 leading-tight">
                    {isEditing ? "Edit Submission" : `${selectedSubmission.firstName} ${selectedSubmission.lastName}`}
                  </h3>
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-neutral-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(selectedSubmission.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!isEditing && (
                  <button
                    onClick={startEditing}
                    className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedSubmission(null); setIsEditing(false) }}
                  className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {isEditing ? (
                /* ── Edit Mode ── */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">First Name</label>
                      <input
                        type="text"
                        value={editForm.firstName || ""}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Last Name</label>
                      <input
                        type="text"
                        value={editForm.lastName || ""}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Company</label>
                      <input
                        type="text"
                        value={editForm.company || ""}
                        onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Source</label>
                    <input
                      type="text"
                      value={editForm.source || ""}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-medium text-neutral-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Message</label>
                    <textarea
                      value={editForm.message || ""}
                      onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-800 resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">First Name</p>
                        <p className="text-[13px] text-neutral-800 font-medium mt-0.5 truncate">
                          {selectedSubmission.firstName || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Last Name</p>
                        <p className="text-[13px] text-neutral-800 font-medium mt-0.5 truncate">
                          {selectedSubmission.lastName || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <Mail className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Email</p>
                        <a
                          href={`mailto:${selectedSubmission.email}`}
                          className="text-[13px] text-blue-600 hover:text-blue-700 font-medium mt-0.5 truncate block"
                        >
                          {selectedSubmission.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <Phone className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Phone</p>
                        {selectedSubmission.phone ? (
                          <a
                            href={`tel:${selectedSubmission.phone}`}
                            className="text-[13px] text-blue-600 hover:text-blue-700 font-medium mt-0.5 truncate block"
                          >
                            {selectedSubmission.phone}
                          </a>
                        ) : (
                          <p className="text-[13px] text-neutral-400 font-normal mt-0.5">—</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <Building2 className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Company</p>
                        <p className="text-[13px] text-neutral-800 font-medium mt-0.5 truncate">
                          {selectedSubmission.company || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                      <Globe className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Source</p>
                        <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-white tracking-wide">
                          {selectedSubmission.source}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  {selectedSubmission.message && (
                    <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-neutral-400" />
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Message</p>
                      </div>
                      <p className="text-[13px] text-neutral-700 font-normal leading-relaxed whitespace-pre-wrap">
                        {selectedSubmission.message}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleDelete(selectedSubmission.id, selectedSubmission.email)
                      setSelectedSubmission(null)
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setSelectedSubmission(null)}
                      className="px-4 py-2 text-[13px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Event Registrations Tab ──

function EventRegistrationsTab({
  setToast,
}: {
  setToast: (t: Toast | null) => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<EventRegistration[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedEvent, setSelectedEvent] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/event-registrations?action=counts")
      const data = await res.json()
      if (data.success) setCounts(data.counts)
    } catch (err) {
      console.error("Error fetching event registration counts:", err)
    }
  }, [])

  const fetchRegistrations = useCallback(async (eventSlug?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const url = eventSlug
        ? `/api/admin/event-registrations?event=${encodeURIComponent(eventSlug)}`
        : "/api/admin/event-registrations"
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setRegistrations(data.registrations)
      } else {
        setError(data.error || "Failed to fetch registrations")
      }
    } catch {
      setError("Failed to fetch event registrations")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
    fetchRegistrations()
  }, [fetchCounts, fetchRegistrations])

  const handleFilterByEvent = (eventName: string) => {
    setSelectedEvent(eventName)
    if (eventName) {
      // Filter client-side since we have all data
      // No need to re-fetch
    }
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete registration for ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/event-registrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted registration for ${email}`, type: "success" })
        setRegistrations((prev) => prev.filter((r) => r.id !== id))
        if (selectedRegistration?.id === id) setSelectedRegistration(null)
        await fetchCounts()
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete registration", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true)
      const url = "/api/admin/event-registrations?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `event-registrations-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${registrations.length} registrations`, type: "success" })
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

  // Filter registrations
  const filteredRegistrations = registrations.filter((r) => {
    if (selectedEvent && r.eventName !== selectedEvent) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.email.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        r.eventName.toLowerCase().includes(q)
      )
    }
    return true
  }).sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Event Registrations
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Registration data from Digital Canvas and SA Tech Day events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchCounts(); fetchRegistrations() }}
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

      {/* Event Cards */}
      {Object.keys(counts).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 mb-6">
          <button
            onClick={() => handleFilterByEvent("")}
            className={`p-3 rounded-xl border transition-all text-left ${
              selectedEvent === ""
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Ticket className="w-3 h-3 opacity-50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">All Events</span>
            </div>
            <div className="text-xl font-bold leading-tight">{totalCount.toLocaleString()}</div>
            <div className="text-[11px] opacity-50 font-normal leading-snug">registrations</div>
          </button>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([eventName, count]) => (
              <button
                key={eventName}
                onClick={() => handleFilterByEvent(eventName)}
                className={`p-3 rounded-xl border transition-all text-left ${
                  selectedEvent === eventName
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                    : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Ticket className="w-3 h-3 opacity-50" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                    {eventName}
                  </span>
                </div>
                <div className="text-xl font-bold leading-tight">{count.toLocaleString()}</div>
                <div className="text-[11px] opacity-50 font-normal leading-snug">registrations</div>
              </button>
            ))}
        </div>
      )}

      {/* Search */}
      {registrations.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
            <input
              type="text"
              placeholder="Search by name, email, company, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-700"
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      {registrations.length > 0 && (
        <div className="flex items-center gap-2 text-neutral-500 mb-4">
          <Users className="w-4 h-4" />
          <span className="text-[13px] font-normal leading-snug">
            Showing{" "}
            <strong className="text-neutral-900 font-semibold">
              {filteredRegistrations.length.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="text-neutral-900 font-semibold">
              {totalCount.toLocaleString()}
            </strong>{" "}
            registrations
            {selectedEvent && (
              <>
                {" "}for{" "}
                <strong className="text-neutral-900 font-semibold">{selectedEvent}</strong>
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
            onClick={() => fetchRegistrations()}
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
          <p className="text-neutral-400 text-[13px] font-normal">Loading event registrations...</p>
        </div>
      )}

      {/* Registrations Table */}
      {!isLoading && !error && registrations.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    First Name
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Last Name
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Email
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden md:table-cell">
                    Company
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Event
                  </th>
                  <th className="text-left px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden sm:table-cell">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Registered
                    </span>
                  </th>
                  <th className="text-center px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Feed
                  </th>
                  <th className="text-right px-4 sm:px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-neutral-400">
                      <Ticket className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No registrations found</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr
                      key={reg.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedRegistration(reg)}
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                          {reg.firstName || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-900 text-[13px] font-medium leading-snug">
                          {reg.lastName || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-neutral-600 text-[13px] font-normal leading-snug">
                          {reg.email}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 hidden md:table-cell">
                        <span className="text-neutral-500 text-[12px] font-normal">
                          {reg.company || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide">
                          {reg.eventName}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-neutral-400 text-[12px] font-normal whitespace-nowrap hidden sm:table-cell">
                        {formatDate(reg.registeredAt)}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-center hidden lg:table-cell">
                        {reg.subscribeToFeed ? (
                          <Check className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRegistration(reg)
                            }}
                            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(reg.id!, reg.email)
                            }}
                            disabled={isDeleting === reg.id}
                            className="p-1.5 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={`Delete ${reg.email}`}
                          >
                            {isDeleting === reg.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRegistrations.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-normal">
                {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? "s" : ""} in table
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

      {/* No data */}
      {!isLoading && !error && registrations.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center shadow-sm">
          <Ticket className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-500">No event registrations found</p>
          <p className="text-[12px] text-neutral-400 mt-1 font-normal">
            Event registrations will appear here once collected
          </p>
        </div>
      )}

      {/* Registration Detail Modal */}
      {selectedRegistration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRegistration(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

          <div
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                  {(selectedRegistration.firstName?.[0] || "").toUpperCase()}
                  {(selectedRegistration.lastName?.[0] || "").toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-neutral-900 leading-tight">
                    {selectedRegistration.fullName || `${selectedRegistration.firstName} ${selectedRegistration.lastName}`.trim()}
                  </h3>
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-neutral-400">
                    <Clock className="w-3 h-3" />
                    Registered {formatDate(selectedRegistration.registeredAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Name</p>
                    <p className="text-[13px] text-neutral-800 font-medium mt-0.5 truncate">
                      {selectedRegistration.fullName || `${selectedRegistration.firstName} ${selectedRegistration.lastName}`.trim() || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <Mail className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Email</p>
                    <a
                      href={`mailto:${selectedRegistration.email}`}
                      className="text-[13px] text-blue-600 hover:text-blue-700 font-medium mt-0.5 truncate block"
                    >
                      {selectedRegistration.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <Building2 className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Company</p>
                    <p className="text-[13px] text-neutral-800 font-medium mt-0.5 truncate">
                      {selectedRegistration.company || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <Globe className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Source</p>
                    <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-900 text-white tracking-wide">
                      {selectedRegistration.source}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Info */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="w-4 h-4 text-neutral-400" />
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Event Details</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Event</p>
                    <p className="text-[13px] text-neutral-800 font-medium mt-0.5">{selectedRegistration.eventName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Event Date</p>
                    <p className="text-[13px] text-neutral-800 font-medium mt-0.5">{formatDate(selectedRegistration.eventDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Subscribed to Feed</p>
                    <p className="text-[13px] text-neutral-800 font-medium mt-0.5">
                      {selectedRegistration.subscribeToFeed ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <Check className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : "No"}
                    </p>
                  </div>
                  {selectedRegistration.tags?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Tags</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedRegistration.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200 text-neutral-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Page URL */}
              {selectedRegistration.pageUrl && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <MapPin className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Registered From</p>
                    <a
                      href={selectedRegistration.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-blue-600 hover:text-blue-700 font-normal mt-0.5 truncate block"
                    >
                      {selectedRegistration.pageUrl.replace(/https?:\/\//, "").split("?")[0]}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
              <button
                onClick={() => {
                  handleDelete(selectedRegistration.id!, selectedRegistration.email)
                  setSelectedRegistration(null)
                }}
                className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="px-4 py-2 text-[13px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
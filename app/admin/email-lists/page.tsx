"use client"

import { useState, useEffect } from "react"
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
  Users,
  Globe,
  FileDown,
  Database,
  ArrowRight,
} from "lucide-react"

interface EmailSignup {
  id: string
  email: string
  source: string
  created_at: string
}

interface Toast {
  message: string
  type: "success" | "error"
}

export default function EmailListsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  
  const [signups, setSignups] = useState<EmailSignup[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedSource, setSelectedSource] = useState<string>("AIM")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [datePreset, setDatePreset] = useState<string>("")
  const [isMigrating, setIsMigrating] = useState(false)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Fetch sources and counts on mount
  useEffect(() => {
    fetchSourcesAndCounts()
  }, [])

  // Fetch signups when source changes
  useEffect(() => {
    if (selectedSource) {
      fetchSignups(selectedSource)
    }
  }, [selectedSource])

  const fetchSourcesAndCounts = async () => {
    try {
      const [sourcesRes, countsRes] = await Promise.all([
        fetch("/api/admin/email-lists-firestore?action=sources"),
        fetch("/api/admin/email-lists-firestore?action=counts"),
      ])

      const sourcesData = await sourcesRes.json()
      const countsData = await countsRes.json()

      if (sourcesData.success) {
        setSources(sourcesData.sources)
      }
      if (countsData.success) {
        setCounts(countsData.counts)
      }
    } catch (err) {
      console.error("Error fetching sources:", err)
    }
  }

  const fetchSignups = async (source?: string) => {
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
    } catch (err) {
      setError("Failed to fetch email signups")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Migration function
  const handleMigrate = async () => {
    if (!confirm("This will migrate all emails from Airtable to Firestore. Continue?")) {
      return
    }
    
    try {
      setIsMigrating(true)
      const res = await fetch("/api/admin/email-lists-firestore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "migrate" }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setToast({ 
          message: `Migration complete! ${data.result?.migrated || 0} emails migrated, ${data.result?.skipped || 0} skipped`, 
          type: "success" 
        })
        // Refresh data
        await fetchSourcesAndCounts()
        await fetchSignups(selectedSource)
      } else {
        setToast({ message: data.error || "Migration failed", type: "error" })
      }
    } catch (err) {
      setToast({ message: "Failed to run migration", type: "error" })
      console.error(err)
    } finally {
      setIsMigrating(false)
    }
  }

  // Download all emails from selected source
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
    } catch (err) {
      setToast({ message: "Failed to download CSV", type: "error" })
      console.error(err)
    } finally {
      setIsDownloading(false)
    }
  }

  // Download only filtered/displayed emails
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
          row.map((cell) => {
            const escaped = String(cell).replace(/"/g, '""')
            return escaped.includes(",") || escaped.includes('"') ? `"${escaped}"` : escaped
          }).join(",")
        ),
      ].join("\n")
      
      const blob = new Blob([csvContent], { type: "text/csv" })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      
      // Build filename with date range if applicable
      let filename = selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"
      filename += "-emails"
      if (startDate && endDate) {
        filename += `-${startDate}-to-${endDate}`
      } else if (startDate) {
        filename += `-from-${startDate}`
      } else if (endDate) {
        filename += `-until-${endDate}`
      } else {
        filename += `-${new Date().toISOString().split("T")[0]}`
      }
      filename += ".csv"
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      setToast({ message: `Downloaded ${filteredSignups.length} emails`, type: "success" })
    } catch (err) {
      setToast({ message: "Failed to download CSV", type: "error" })
      console.error(err)
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

  // Filter signups by search query and date range
  const filteredSignups = signups.filter((signup) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!signup.email.toLowerCase().includes(query)) return false
    }
    
    // Date range filter
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

  // Handle date preset selection
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split("T")[0]
    
    switch (preset) {
      case "today":
        setStartDate(formatDate(today))
        setEndDate(formatDate(today))
        break
      case "yesterday":
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        setStartDate(formatDate(yesterday))
        setEndDate(formatDate(yesterday))
        break
      case "last7days":
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 7)
        setStartDate(formatDate(last7))
        setEndDate(formatDate(today))
        break
      case "last30days":
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 30)
        setStartDate(formatDate(last30))
        setEndDate(formatDate(today))
        break
      case "thisMonth":
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        setStartDate(formatDate(firstOfMonth))
        setEndDate(formatDate(today))
        break
      case "lastMonth":
        const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        setStartDate(formatDate(firstOfLastMonth))
        setEndDate(formatDate(lastOfLastMonth))
        break
      case "thisYear":
        const firstOfYear = new Date(today.getFullYear(), 0, 1)
        setStartDate(formatDate(firstOfYear))
        setEndDate(formatDate(today))
        break
      case "all":
      default:
        setStartDate("")
        setEndDate("")
        break
    }
  }

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate("")
    setEndDate("")
    setDatePreset("")
  }

  // Get total count for selected source
  const totalCount = selectedSource ? (counts[selectedSource] || 0) : Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen bg-gray-50 pt-18">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}>
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-medium">Back to Admin</span>
              </Link>
              <div className="h-6 w-px bg-gray-200 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2">
                <Mail className="w-5 h-5 text-gray-700" />
                <h1 className="text-lg font-semibold text-gray-900">Email Lists</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Migrate from Airtable"
              >
                {isMigrating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
                <span className="hidden lg:inline text-sm">Migrate</span>
              </button>
              <button
                onClick={() => fetchSignups(selectedSource)}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleDownloadAllCSV}
                disabled={isDownloading || totalCount === 0}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Export All</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Title - Mobile */}
        <div className="sm:hidden mb-6">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-700" />
            <h1 className="text-xl font-semibold text-gray-900">Email Lists</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Manage and export email signups</p>
        </div>

        {/* Source Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([source, count]) => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`p-3 sm:p-4 rounded-xl border transition-all text-left ${
                  selectedSource === source
                    ? "bg-gray-900 text-white border-gray-900 shadow-lg"
                    : "bg-white text-gray-900 border-gray-200 hover:border-gray-400 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-60" />
                  <span className="text-xs font-semibold uppercase tracking-wide truncate">{source}</span>
                </div>
                <div className="text-xl sm:text-2xl font-bold">{count.toLocaleString()}</div>
                <div className="text-xs opacity-60">emails</div>
              </button>
            ))}
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6 shadow-sm">
          {/* Row 1: Source and Search */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3">
            {/* Source Filter */}
            <div className="flex items-center gap-2 flex-1">
              <Filter className="w-5 h-5 text-gray-400 hidden sm:block" />
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm sm:text-base"
              >
                <option value="">All Sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source} ({counts[source] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Row 2: Date Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 border-t border-gray-100">
            {/* Date Preset */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 hidden sm:block" />
              <select
                value={datePreset}
                onChange={(e) => handleDatePreset(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm"
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

            {/* Custom Date Range */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-500 hidden sm:inline">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset("")
                }}
                className="flex-1 sm:flex-none px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset("")
                }}
                className="flex-1 sm:flex-none px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm"
              />
            </div>

            {/* Clear Date Filters */}
            {(startDate || endDate) && (
              <button
                onClick={clearDateFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Results Summary & Download Filtered */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-gray-600">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span className="text-sm sm:text-base">
                Showing <strong className="text-gray-900">{filteredSignups.length.toLocaleString()}</strong> of{" "}
                <strong className="text-gray-900">{totalCount.toLocaleString()}</strong> emails
                {selectedSource && <> from <strong className="text-gray-900">{selectedSource}</strong></>}
              </span>
            </div>
            {(startDate || endDate) && (
              <span className="text-xs sm:text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {startDate && endDate 
                  ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                  : startDate 
                    ? `From ${formatDate(startDate)}`
                    : `Until ${formatDate(endDate)}`}
              </span>
            )}
          </div>
          {filteredSignups.length > 0 && (searchQuery || startDate || endDate) && (
            <button
              onClick={handleDownloadFilteredCSV}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Download Filtered ({filteredSignups.length})
            </button>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={() => fetchSignups(selectedSource)}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Loading email signups...</p>
          </div>
        )}

        {/* Email Table */}
        {!isLoading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Email
                    </th>
                    <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Source
                    </th>
                    <th className="text-left px-4 sm:px-6 py-3 sm:py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Signup</span> Date
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSignups.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                        <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">No email signups found</p>
                        {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                      </td>
                    </tr>
                  ) : (
                    filteredSignups.map((signup) => (
                      <tr key={signup.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <span className="text-gray-900 font-medium text-sm sm:text-base">
                            {signup.email}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {signup.source}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm whitespace-nowrap">
                          {formatDate(signup.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer */}
            {filteredSignups.length > 0 && (
              <div className="bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
                <span className="text-xs sm:text-sm text-gray-500">
                  {filteredSignups.length} email{filteredSignups.length !== 1 ? "s" : ""} in table
                </span>
                <button
                  onClick={handleDownloadFilteredCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 sm:mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Weekly Email Export
          </h3>
          <p className="text-blue-800 text-sm leading-relaxed">
            Coming soon: Automated weekly email reports will be sent directly to admin with the latest 
            email signups filtered by source. The CSV will be attached for easy import into Mailchimp.
          </p>
        </div>
      </main>
    </div>
  )
}

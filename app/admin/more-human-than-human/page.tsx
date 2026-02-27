"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Loader2,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Users,
  Mic2,
  Sparkles,
  Ticket,
  UserPlus,
  Building2,
  Mail,
  User,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Calendar,
  CircleCheck,
  Circle,
  RocketIcon,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"

// ── Types ──

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
  checkedIn?: boolean
  checkedInAt?: string
}

interface Toast {
  message: string
  type: "success" | "error"
}

type ActiveSection = "speakers" | "spotlights" | "registrations" | "walk-up"

// ── Robot/Android Icon ──
function RobotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 2v6" />
      <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="14" r="1.5" />
      <circle cx="15.5" cy="14" r="1.5" />
      <path d="M9 18h6" />
      <path d="M1 12v4" />
      <path d="M23 12v4" />
    </svg>
  )
}

// ── Main Component ──

export default function MoreHumanThanHumanPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("registrations")
  const [toast, setToast] = useState<Toast | null>(null)
  const [registrations, setRegistrations] = useState<EventRegistration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState<string | null>(null)

  // Walk-up form state
  const [walkUpForm, setWalkUpForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
  })
  const [isSavingWalkUp, setIsSavingWalkUp] = useState(false)

  // Quick-add form state (for speakers, spotlights, registrations)
  const [quickAddForm, setQuickAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
  })
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Fetch MHTH registrations
  const fetchRegistrations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(
        `/api/admin/event-registrations?event=MoreHumanThanHuman2026&_t=${Date.now()}`,
        { cache: "no-store" }
      )
      const data = await res.json()
      if (data.success) {
        setRegistrations(data.registrations)
      } else {
        setError(data.error || "Failed to fetch registrations")
      }
    } catch {
      setError("Failed to fetch registrations")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegistrations()
  }, [fetchRegistrations])

  // Categorize registrations
  const categorized = useMemo(() => {
    const speakers: EventRegistration[] = []
    const spotlights: EventRegistration[] = []
    const general: EventRegistration[] = []

    registrations.forEach((reg) => {
      const tags = reg.tags.map((t) => t.toLowerCase())
      if (tags.includes("speaker") || tags.includes("panelist") || tags.includes("keynote")) {
        speakers.push(reg)
      } else if (tags.includes("community-spotlight") || tags.includes("spotlight") || tags.includes("community")) {
        spotlights.push(reg)
      } else {
        general.push(reg)
      }
    })

    return { speakers, spotlights, general }
  }, [registrations])

  // Filter based on search
  const filterList = useCallback(
    (list: EventRegistration[]) => {
      if (!searchQuery) return list
      const q = searchQuery.toLowerCase()
      return list.filter(
        (r) =>
          r.firstName.toLowerCase().includes(q) ||
          r.lastName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.company || "").toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q)
      )
    },
    [searchQuery]
  )

  // Get the display list for the active section
  const displayList = useMemo(() => {
    switch (activeSection) {
      case "speakers":
        return filterList(categorized.speakers)
      case "spotlights":
        return filterList(categorized.spotlights)
      case "registrations":
        return filterList(categorized.general)
      default:
        return []
    }
  }, [activeSection, categorized, filterList])

  // Checked-in registrations (across all categories)
  const checkedInList = useMemo(() => {
    return registrations.filter((r) => r.checkedIn)
  }, [registrations])

  // Not-checked-in for display (exclude checked-in from active list)
  const uncheckedDisplayList = useMemo(() => {
    return displayList.filter((r) => !r.checkedIn)
  }, [displayList])

  // Check-in handler
  const handleCheckIn = async (id: string, name: string) => {
    try {
      setCheckingIn(id)
      const res = await fetch("/api/admin/event-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkedIn: true }),
      })
      const data = await res.json()
      if (data.success) {
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, checkedIn: true, checkedInAt: data.checkedInAt } : r
          )
        )
        setToast({ message: `Checked in: ${name}`, type: "success" })
      } else {
        setToast({ message: data.error || "Failed to check in", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to check in", type: "error" })
    } finally {
      setCheckingIn(null)
    }
  }

  // Undo check-in handler
  const handleUndoCheckIn = async (id: string, name: string) => {
    try {
      setCheckingIn(id)
      const res = await fetch("/api/admin/event-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, checkedIn: false }),
      })
      const data = await res.json()
      if (data.success) {
        setRegistrations((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, checkedIn: false, checkedInAt: "" } : r
          )
        )
        setToast({ message: `Undo check-in: ${name}`, type: "success" })
      } else {
        setToast({ message: data.error || "Failed to undo check-in", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to undo check-in", type: "error" })
    } finally {
      setCheckingIn(null)
    }
  }

  // Delete handler
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
        if (expandedRow === id) setExpandedRow(null)
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete registration", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  // CSV download
  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true)
      const res = await fetch(
        `/api/admin/event-registrations?event=MoreHumanThanHuman2026&format=csv`
      )
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `mhth-registrations-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({
        message: `Downloaded ${registrations.length} registrations`,
        type: "success",
      })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  // Walk-up submission
  const handleWalkUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkUpForm.firstName || !walkUpForm.lastName || !walkUpForm.email) {
      setToast({ message: "First name, last name, and email are required", type: "error" })
      return
    }

    try {
      setIsSavingWalkUp(true)
      const res = await fetch("/api/admin/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: walkUpForm.firstName,
          lastName: walkUpForm.lastName,
          email: walkUpForm.email,
          company: walkUpForm.company || null,
          event: "MoreHumanThanHuman2026",
          eventName: "More Human Than Human",
          eventDate: "2026-02-28",
          source: "walk-up",
          tags: ["walk-up", "more-human-than-human"],
        }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Walk-up registered: ${walkUpForm.firstName} ${walkUpForm.lastName}`, type: "success" })
        setWalkUpForm({ firstName: "", lastName: "", email: "", company: "" })
        // Add to local state directly
        if (data.registration) {
          setRegistrations((prev) => [data.registration, ...prev])
        } else {
          await fetchRegistrations()
        }
      } else {
        setToast({ message: data.error || "Failed to register walk-up", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to register walk-up", type: "error" })
    } finally {
      setIsSavingWalkUp(false)
    }
  }

  // Quick-add submission (for speakers, spotlights, registrations)
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAddForm.firstName || !quickAddForm.lastName || !quickAddForm.email) {
      setToast({ message: "First name, last name, and email are required", type: "error" })
      return
    }

    // Determine tags based on active section
    let tags: string[] = ["more-human-than-human"]
    let source = "admin-manual"
    if (activeSection === "speakers") {
      tags = ["speaker", "more-human-than-human"]
    } else if (activeSection === "spotlights") {
      tags = ["community-spotlight", "more-human-than-human"]
    }

    try {
      setIsSavingQuickAdd(true)
      const res = await fetch("/api/admin/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: quickAddForm.firstName,
          lastName: quickAddForm.lastName,
          email: quickAddForm.email,
          company: quickAddForm.company || null,
          event: "MoreHumanThanHuman2026",
          eventName: "More Human Than Human",
          eventDate: "2026-02-28",
          source,
          tags,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const label = activeSection === "speakers" ? "Speaker" : activeSection === "spotlights" ? "Spotlight" : "Registration"
        const verb = data.merged ? "updated" : "added"
        setToast({ message: `${label} ${verb}: ${quickAddForm.firstName} ${quickAddForm.lastName}`, type: "success" })
        setQuickAddForm({ firstName: "", lastName: "", email: "", company: "" })
        // Always refresh from Firestore to ensure accurate state
        await fetchRegistrations()
      } else {
        setToast({ message: data.error || "Failed to add", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to add", type: "error" })
    } finally {
      setIsSavingQuickAdd(false)
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

  const formatTime = (dateString: string) => {
    if (!dateString) return ""
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const tabs: {
    id: ActiveSection
    label: string
    icon: React.ReactNode
    count: number
  }[] = [
    {
      id: "registrations",
      label: "Registrations",
      icon: <Ticket className="w-3.5 h-3.5" />,
      count: categorized.general.length,
    },
    {
      id: "speakers",
      label: "Speakers",
      icon: <Mic2 className="w-3.5 h-3.5" />,
      count: categorized.speakers.length,
    },
    {
      id: "spotlights",
      label: "Community Spotlights",
      icon: <RocketIcon className="w-3.5 h-3.5" />,
      count: categorized.spotlights.length,
    },
    {
      id: "walk-up",
      label: "Walk-Up",
      icon: <UserPlus className="w-3.5 h-3.5" />,
      count: 0,
    },
  ]

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-dvh bg-neutral-50 text-neutral-900 pt-20 md:pt-16">
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
              <span className="leading-snug">{toast.message}</span>
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
                  <RobotIcon className="w-4 h-4 text-neutral-600" />
                  <h1 className="text-sm font-semibold text-neutral-800 tracking-wide uppercase">
                    More Human Than Human
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchRegistrations}
                  disabled={isLoading}
                  className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={handleDownloadCSV}
                  disabled={isDownloading || registrations.length === 0}
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

            {/* Tab Navigation */}
            <nav className="flex gap-0 -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors whitespace-nowrap ${
                    activeSection === tab.id
                      ? "text-neutral-900"
                      : "text-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full leading-none ${
                        activeSection === tab.id
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {activeSection === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

          {/* Walk-Up Section */}
          {activeSection === "walk-up" && (
            <div className="space-y-6">
              {/* Walk-Up Form */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <div className="px-5 py-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <UserPlus className="w-5 h-5 text-neutral-600" />
                    <div>
                      <h2 className="text-[15px] font-semibold text-neutral-900 leading-tight tracking-tight">
                        Walk-Up Registration
                      </h2>
                      <p className="text-[12px] text-neutral-400 font-normal leading-relaxed mt-0.5">
                        Register attendees who arrive without prior registration. Data saves directly to Firestore.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleWalkUpSubmit} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 leading-none">
                        First Name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                        <input
                          type="text"
                          value={walkUpForm.firstName}
                          onChange={(e) =>
                            setWalkUpForm((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="First name"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 leading-none">
                        Last Name <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                        <input
                          type="text"
                          value={walkUpForm.lastName}
                          onChange={(e) =>
                            setWalkUpForm((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="Last name"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 leading-none">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                        <input
                          type="email"
                          value={walkUpForm.email}
                          onChange={(e) =>
                            setWalkUpForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 leading-none">
                        Company
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                        <input
                          type="text"
                          value={walkUpForm.company}
                          onChange={(e) =>
                            setWalkUpForm((prev) => ({ ...prev, company: e.target.value }))
                          }
                          className="w-full pl-9 pr-3 py-2.5 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="Company (optional)"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingWalkUp}
                      className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-[13px] font-semibold rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors tracking-wide"
                    >
                      {isSavingWalkUp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Register Walk-Up
                    </button>
                  </div>
                </form>
              </div>

              {/* Recent Walk-Ups */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <div className="px-5 py-4 border-b border-neutral-100">
                  <h3 className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight">
                    Recent Walk-Up Registrations
                  </h3>
                  <p className="text-[12px] text-neutral-400 font-normal leading-relaxed mt-0.5">
                    Attendees registered at the door
                  </p>
                </div>
                <RegistrationTable
                  registrations={registrations.filter((r) => r.source === "walk-up")}
                  isDeleting={isDeleting}
                  expandedRow={expandedRow}
                  setExpandedRow={setExpandedRow}
                  handleDelete={handleDelete}
                  handleCheckIn={handleCheckIn}
                  checkingIn={checkingIn}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  emptyMessage="No walk-up registrations yet"
                />
              </div>
            </div>
          )}

          {/* Speakers / Spotlights / Registrations Sections */}
          {activeSection !== "walk-up" && (
            <div className="space-y-4">
              {/* Quick Add Form */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <button
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Plus className="w-4 h-4 text-neutral-500" />
                    <span className="text-[13px] font-semibold text-neutral-700 leading-tight tracking-tight">
                      {activeSection === "speakers" ? "Add Speaker" : activeSection === "spotlights" ? "Add Spotlight" : "Add Registration"}
                    </span>
                  </div>
                  {showQuickAdd ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  )}
                </button>

                {showQuickAdd && (
                  <form onSubmit={handleQuickAddSubmit} className="px-5 pb-5 pt-1 space-y-3 border-t border-neutral-100">
                    <p className="text-[11px] text-neutral-400 font-normal leading-relaxed pt-3">
                      {activeSection === "speakers"
                        ? "Manually add a speaker or panelist. Saves to Firestore with the \"speaker\" tag."
                        : activeSection === "spotlights"
                        ? "Manually add a community spotlight. Saves to Firestore with the \"community-spotlight\" tag."
                        : "Manually add a registration. Saves to Firestore."}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 leading-none">
                          First Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={quickAddForm.firstName}
                          onChange={(e) => setQuickAddForm((prev) => ({ ...prev, firstName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="First name"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 leading-none">
                          Last Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={quickAddForm.lastName}
                          onChange={(e) => setQuickAddForm((prev) => ({ ...prev, lastName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="Last name"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 leading-none">
                          Email <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="email"
                          value={quickAddForm.email}
                          onChange={(e) => setQuickAddForm((prev) => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="email@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 leading-none">
                          Company
                        </label>
                        <input
                          type="text"
                          value={quickAddForm.company}
                          onChange={(e) => setQuickAddForm((prev) => ({ ...prev, company: e.target.value }))}
                          className="w-full px-3 py-2 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                          placeholder="Company (optional)"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isSavingQuickAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-[13px] font-semibold rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors tracking-wide"
                      >
                        {isSavingQuickAdd ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        {activeSection === "speakers" ? "Add Speaker" : activeSection === "spotlights" ? "Add Spotlight" : "Add Registration"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Search */}
              {uncheckedDisplayList.length > 0 || searchQuery ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 shadow-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 text-sm font-medium text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent leading-snug placeholder:text-neutral-300"
                      placeholder={`Search ${activeSection}...`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="mt-2 text-[12px] text-neutral-400 font-normal leading-snug">
                      Showing {uncheckedDisplayList.length} of{" "}
                      {activeSection === "speakers"
                        ? categorized.speakers.length
                        : activeSection === "spotlights"
                        ? categorized.spotlights.length
                        : categorized.general.length}{" "}
                      results
                    </div>
                  )}
                </div>
              ) : null}

              {/* Section header */}
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900 leading-tight tracking-tight">
                  {activeSection === "speakers" && "Speakers & Panelists"}
                  {activeSection === "spotlights" && "Community Spotlights"}
                  {activeSection === "registrations" && "All Registrations"}
                </h2>
                <span className="text-[12px] text-neutral-400 font-medium leading-none">
                  {uncheckedDisplayList.length} pending
                </span>
              </div>

              {/* Loading / Error / Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
                  <p className="text-sm font-medium text-red-600 leading-snug">{error}</p>
                  <button
                    onClick={fetchRegistrations}
                    className="mt-3 px-4 py-2 text-[13px] font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                    <RegistrationTable
                      registrations={uncheckedDisplayList}
                      isDeleting={isDeleting}
                      expandedRow={expandedRow}
                      setExpandedRow={setExpandedRow}
                      handleDelete={handleDelete}
                      handleCheckIn={handleCheckIn}
                      checkingIn={checkingIn}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      emptyMessage={
                        activeSection === "speakers"
                          ? "No speakers found. Tag registrations with 'speaker' to classify them."
                          : activeSection === "spotlights"
                          ? "No community spotlights found. Tag registrations with 'community-spotlight' to classify them."
                          : "No registrations found"
                      }
                    />
                  </div>

                  {/* Checked In Section */}
                  {checkedInList.length > 0 && (
                    <div className="mt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <CircleCheck className="w-4 h-4 text-green-500" />
                        <h2 className="text-[15px] font-semibold text-neutral-900 leading-tight tracking-tight">
                          Checked In
                        </h2>
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-green-50 text-green-600 rounded-full leading-none">
                          {checkedInList.length}
                        </span>
                      </div>
                      <div className="bg-white rounded-xl border border-green-100 shadow-sm">
                        <CheckedInTable
                          registrations={checkedInList}
                          handleUndoCheckIn={handleUndoCheckIn}
                          checkingIn={checkingIn}
                          formatDate={formatDate}
                          formatTime={formatTime}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}

// ── Registration Table Component ──

function RegistrationTable({
  registrations,
  isDeleting,
  expandedRow,
  setExpandedRow,
  handleDelete,
  handleCheckIn,
  checkingIn,
  formatDate,
  formatTime,
  emptyMessage,
}: {
  registrations: EventRegistration[]
  isDeleting: string | null
  expandedRow: string | null
  setExpandedRow: (id: string | null) => void
  handleDelete: (id: string, email: string) => void
  handleCheckIn: (id: string, name: string) => void
  checkingIn: string | null
  formatDate: (d: string) => string
  formatTime: (d: string) => string
  emptyMessage: string
}) {
  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Users className="w-8 h-8 text-neutral-200 mb-3" />
        <p className="text-[13px] text-neutral-400 font-normal leading-relaxed max-w-xs">
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {/* Desktop Table */}
      <table className="w-full hidden sm:table">
        <thead>
          <tr className="border-b border-neutral-100">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
              Name
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
              Email
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
              Company
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
              Registered
            </th>
            <th className="text-center px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
              Check In
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {registrations
            .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
            .map((reg) => (
            <tr
              key={reg.id}
              className="border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="text-[13px] font-semibold text-neutral-900 leading-snug">
                  {reg.firstName} {reg.lastName}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-[13px] text-neutral-600 font-medium leading-snug">
                  {reg.email}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-[13px] text-neutral-500 font-normal leading-snug">
                  {reg.company || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-[12px] text-neutral-500 font-normal leading-snug">
                  {formatDate(reg.registeredAt)}
                </div>
                <div className="text-[11px] text-neutral-300 font-normal leading-snug">
                  {formatTime(reg.registeredAt)}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => handleCheckIn(reg.id, `${reg.firstName} ${reg.lastName}`)}
                  disabled={checkingIn === reg.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-neutral-500 hover:text-green-600 bg-neutral-50 hover:bg-green-50 border border-neutral-200 hover:border-green-200 rounded-lg transition-all disabled:opacity-50 leading-none"
                  title="Check in"
                >
                  {checkingIn === reg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  Check In
                </button>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleDelete(reg.id, reg.email)}
                  disabled={isDeleting === reg.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                  title="Delete"
                >
                  {isDeleting === reg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Cards */}
      <div className="sm:hidden divide-y divide-neutral-100">
        {registrations
          .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
          .map((reg) => (
          <div key={reg.id} className="p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setExpandedRow(expandedRow === reg.id ? null : reg.id)}
                className="flex-1 text-left"
              >
                <div className="text-[13px] font-semibold text-neutral-900 leading-snug">
                  {reg.firstName} {reg.lastName}
                </div>
                <div className="text-[12px] text-neutral-400 font-normal leading-snug">
                  {reg.email}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCheckIn(reg.id, `${reg.firstName} ${reg.lastName}`)}
                  disabled={checkingIn === reg.id}
                  className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                  title="Check in"
                >
                  {checkingIn === reg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
                {expandedRow === reg.id ? (
                  <ChevronUp className="w-4 h-4 text-neutral-300" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-300" />
                )}
              </div>
            </div>

            {expandedRow === reg.id && (
              <div className="mt-3 space-y-2 pl-0">
                {reg.company && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Building2 className="w-3.5 h-3.5 text-neutral-300" />
                    <span className="text-neutral-600 font-medium leading-snug">{reg.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[12px]">
                  <Clock className="w-3.5 h-3.5 text-neutral-300" />
                  <span className="text-neutral-500 font-normal leading-snug">
                    {formatDate(reg.registeredAt)} {formatTime(reg.registeredAt)}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(reg.id, reg.email)}
                  disabled={isDeleting === reg.id}
                  className="flex items-center gap-1.5 text-[12px] text-red-500 hover:text-red-600 font-medium mt-1 disabled:opacity-50"
                >
                  {isDeleting === reg.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Checked In Table Component ──

function CheckedInTable({
  registrations,
  handleUndoCheckIn,
  checkingIn,
  formatDate,
  formatTime,
}: {
  registrations: EventRegistration[]
  handleUndoCheckIn: (id: string, name: string) => void
  checkingIn: string | null
  formatDate: (d: string) => string
  formatTime: (d: string) => string
}) {
  if (registrations.length === 0) return null

  return (
    <div className="overflow-x-auto">
      {/* Desktop */}
      <table className="w-full hidden sm:table">
        <thead>
          <tr className="border-b border-green-50">
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-green-500 uppercase tracking-wider leading-none">
              Name
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-green-500 uppercase tracking-wider leading-none">
              Email
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-green-500 uppercase tracking-wider leading-none">
              Company
            </th>
            <th className="text-left px-4 py-3 text-[11px] font-semibold text-green-500 uppercase tracking-wider leading-none">
              Checked In At
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {registrations
            .sort((a, b) => new Date(b.checkedInAt || "").getTime() - new Date(a.checkedInAt || "").getTime())
            .map((reg) => (
            <tr
              key={reg.id}
              className="border-b border-green-50/50 hover:bg-green-50/30 transition-colors group"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <CircleCheck className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-[13px] font-semibold text-neutral-900 leading-snug">
                    {reg.firstName} {reg.lastName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-[13px] text-neutral-600 font-medium leading-snug">
                  {reg.email}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-[13px] text-neutral-500 font-normal leading-snug">
                  {reg.company || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="text-[12px] text-green-600 font-medium leading-snug">
                  {reg.checkedInAt ? formatDate(reg.checkedInAt) : "—"}
                </div>
                <div className="text-[11px] text-green-400 font-normal leading-snug">
                  {reg.checkedInAt ? formatTime(reg.checkedInAt) : ""}
                </div>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleUndoCheckIn(reg.id, `${reg.firstName} ${reg.lastName}`)}
                  disabled={checkingIn === reg.id}
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-all disabled:opacity-50 leading-none"
                  title="Undo check-in"
                >
                  {checkingIn === reg.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Undo"
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="sm:hidden divide-y divide-green-50">
        {registrations
          .sort((a, b) => new Date(b.checkedInAt || "").getTime() - new Date(a.checkedInAt || "").getTime())
          .map((reg) => (
          <div key={reg.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CircleCheck className="w-4 h-4 text-green-500 shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-neutral-900 leading-snug">
                  {reg.firstName} {reg.lastName}
                </div>
                <div className="text-[12px] text-neutral-400 font-normal leading-snug">
                  {reg.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleUndoCheckIn(reg.id, `${reg.firstName} ${reg.lastName}`)}
              disabled={checkingIn === reg.id}
              className="px-2 py-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-all disabled:opacity-50 leading-none"
            >
              {checkingIn === reg.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Undo"
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

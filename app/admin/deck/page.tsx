"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  Plus,
  Search,
  Loader2,
  Presentation,
  AlertCircle,
  RefreshCw,
  Trash2,
  X,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { buildDefaultDeckSlides } from "@/lib/deck/default-deck"
import type { SalesDeck } from "@/types/deck-types"

interface Toast {
  message: string
  type: "success" | "error"
}

function formatRelative(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return null
  const diff = Date.now() - d
  const min = Math.round(diff / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function DeckListPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<SalesDeck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadDecks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/decks")
      if (!res.ok) throw new Error("Failed to fetch decks")
      const data = await res.json()
      setDecks(data.decks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decks")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDecks()
  }, [loadDecks])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/crm/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled deck", slides: buildDefaultDeckSlides() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Failed to create deck")
      }
      const data = await res.json()
      router.push(`/admin/deck/${data.deck.id}`)
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to create deck", type: "error" })
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/crm/decks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete deck")
      setToast({ message: "Deck deleted", type: "success" })
      setDeleteConfirmId(null)
      await loadDecks()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to delete deck", type: "error" })
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = decks.filter((d) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.brand?.toLowerCase().includes(q)
    const matchesStatus = statusFilter === "all" || d.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const publishedCount = decks.filter((d) => d.status === "published").length
  const draftCount = decks.filter((d) => d.status === "draft").length

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white ring-1 ring-neutral-200 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] text-sm"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-neutral-900">{toast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
                  Sales Decks
                </h1>
                <p className="text-sm text-neutral-500 mt-1 tabular-nums">
                  {decks.length} {decks.length === 1 ? "deck" : "decks"}
                  {decks.length > 0 && (
                    <>
                      {" "}· <span className="text-neutral-700">{publishedCount} published</span>{" "}·{" "}
                      <span className="text-neutral-700">{draftCount} draft</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadDecks}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  New deck
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search decks…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                />
              </div>
              <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
                {(["all", "published", "draft"] as const).map((status) => {
                  const isActive = statusFilter === status
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`inline-flex items-center px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                        isActive ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading decks…</span>
              </div>
            ) : error ? (
              <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-neutral-900 mb-1">Couldn&apos;t load decks</p>
                <p className="text-xs text-neutral-500 mb-3">{error}</p>
                <button
                  onClick={loadDecks}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
                  <Presentation className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-neutral-900 mb-1">
                  {decks.length === 0 ? "No decks yet" : "No decks match your filters"}
                </p>
                <p className="text-xs text-neutral-500">
                  {decks.length === 0
                    ? 'Click "New deck" to start from the 434 Media template.'
                    : "Try adjusting search or filters above."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((deck) => {
                  const statusDot = deck.status === "published" ? "bg-emerald-500" : "bg-amber-500"
                  const lastEdited = formatRelative(deck.updated_at)
                  return (
                    <motion.div
                      key={deck.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[box-shadow,outline-color] flex flex-col overflow-hidden"
                    >
                      <button
                        onClick={() => router.push(`/admin/deck/${deck.id}`)}
                        className="aspect-video bg-neutral-100 relative w-full grid place-items-center text-neutral-300 hover:bg-neutral-50 transition-colors"
                        title="Open deck"
                      >
                        <Presentation className="h-8 w-8" />
                        <span
                          className={`absolute top-2 right-2 inline-block h-1.5 w-1.5 rounded-full ${statusDot}`}
                          title={deck.status}
                          aria-hidden="true"
                        />
                      </button>
                      <div className="p-3 flex-1 flex flex-col">
                        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
                          <span className={`inline-block h-1 w-1 rounded-full ${statusDot}`} aria-hidden="true" />
                          {deck.status}
                          {deck.brand && (
                            <>
                              <span className="text-neutral-300">·</span>
                              <span className="normal-case tracking-normal text-neutral-400">{deck.brand}</span>
                            </>
                          )}
                        </p>
                        <h3 className="text-sm font-medium text-neutral-900 leading-snug line-clamp-2 mb-1.5">
                          {deck.name}
                        </h3>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 tabular-nums mt-auto pt-2">
                          <span className="tabular-nums">
                            {deck.slides.length} {deck.slides.length === 1 ? "slide" : "slides"}
                          </span>
                          {lastEdited && (
                            <span className="text-neutral-400" title={`Updated ${deck.updated_at}`}>
                              Updated {lastEdited}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-3">
                          <button
                            onClick={() => router.push(`/admin/deck/${deck.id}`)}
                            className="flex-1 h-7 px-2 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                          {deck.status === "published" && deck.share_id && (
                            <a
                              href={`/deck/${deck.share_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                              title="View live"
                              aria-label="View live"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {deleteConfirmId === deck.id ? (
                            <>
                              <button
                                onClick={() => handleDelete(deck.id)}
                                disabled={isDeleting}
                                className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                                aria-label="Confirm delete"
                              >
                                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                                aria-label="Cancel delete"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(deck.id)}
                              className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 rounded-md transition-colors"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRoleGuard>
  )
}

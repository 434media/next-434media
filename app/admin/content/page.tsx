"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { Toast, SocialCalendarView, ContentDetailDrawer } from "@/components/crm"
import type { Toast as ToastType } from "@/components/crm/types"
import { useContentPostHandlers } from "@/hooks/useContentPostHandlers"

// Same fallback list as lib/auth.ts CRM_SUPER_ADMIN_FALLBACK — lets the review
// action bar render before a session role lookup, for the two known super-admins.
const SUPER_ADMIN_EMAILS = ["marcos@434media.com", "jesse@434media.com"]

// /admin/content — the Social Calendar lifted out of the CRM tab into its own
// route, ahead of the approve/reject + posting pipeline. Data still lives in
// crm_content_posts; this is purely the surface relocation. Mirrors the
// URL-driven drawer pattern used by /admin/leads (?openContent=, ?new=content).

export default function ContentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [toast, setToast] = useState<ToastType | null>(null)
  // Whether the current user can approve/reject (super-admin only). The decision
  // API enforces this server-side; this just gates the UI affordance.
  const [canReview, setCanReview] = useState(false)

  // Holds the latest loadContentPosts so the stable onSaved callback can re-sync
  // without depending on the hook's return (which is defined below).
  const loadRef = useRef<() => void>(() => {})
  // Set right before a save resolves so the deep-link reopen effect doesn't
  // bounce the drawer back open when the post list state updates.
  const suppressReopenRef = useRef(false)

  // After a successful save: suppress the reopen race, drop the ?openContent=
  // param so the drawer stays closed, and re-sync the list so the Calendar
  // reflects the saved date.
  const handleSaved = useCallback(() => {
    const sp = searchParams
    if (sp?.get("openContent")) {
      // Editing an open post: arm the guard and drop the deep-link param so the
      // post-save list update doesn't bounce the drawer back open.
      suppressReopenRef.current = true
      const params = new URLSearchParams(sp.toString())
      params.delete("openContent")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    loadRef.current()
  }, [searchParams, router, pathname])

  const {
    contentPosts,
    isLoading,
    loadContentPosts,
    editingContentPost,
    setEditingContentPost,
    showContentPostForm,
    setShowContentPostForm,
    isSavingContentPost,
    handleAddContentPost,
    handleOpenContentPost,
    handleSaveContentPost,
    handleDeleteContentPost,
    handleMoveContentPost,
    handleBulkDeleteContentPosts,
  } = useContentPostHandlers({ setToast, onSaved: handleSaved })

  // Keep the ref pointed at the current loader for handleSaved.
  useEffect(() => {
    loadRef.current = loadContentPosts
  }, [loadContentPosts])

  // Initial load
  useEffect(() => {
    loadContentPosts()
  }, [loadContentPosts])

  // Resolve whether the current user may approve/reject (super-admin only).
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.authenticated || !data.user) return
        const email = (data.user.email || "").toLowerCase()
        const isSuper =
          SUPER_ADMIN_EMAILS.includes(email) || data.user.role === "crm_super_admin"
        setCanReview(isSuper)
      })
      .catch(() => {
        /* non-fatal — defaults to no review actions */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // ?new=content → open an empty create drawer (command-palette quick action).
  // Strip the param so re-renders don't reopen it after the user closes.
  const newParam = searchParams?.get("new") ?? null
  useEffect(() => {
    if (!newParam) return
    if (newParam === "content") {
      handleAddContentPost()
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("new")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam])

  // ?openContent=<id> — deep-link open a specific content post drawer.
  const openContentId = searchParams?.get("openContent") ?? null
  useEffect(() => {
    if (!openContentId) {
      if (showContentPostForm) {
        setShowContentPostForm(false)
        setEditingContentPost(null)
      }
      return
    }
    // A just-completed save updates contentPosts; don't let that re-open the
    // drawer we just closed (the ?openContent= param is being cleared too).
    if (suppressReopenRef.current) {
      suppressReopenRef.current = false
      return
    }
    if (contentPosts.length === 0) return
    const target = contentPosts.find((p) => p.id === openContentId)
    if (!target) return
    if (editingContentPost?.id === openContentId && showContentPostForm) return
    handleOpenContentPost(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContentId, contentPosts])

  // Keep ?openContent= in sync when the drawer opens via direct interaction
  useEffect(() => {
    if (!showContentPostForm || !editingContentPost?.id) return
    if (searchParams?.get("openContent") === editingContentPost.id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("openContent", editingContentPost.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContentPostForm, editingContentPost?.id])

  const closeContentDrawer = () => {
    setShowContentPostForm(false)
    setEditingContentPost(null)
    if (searchParams?.get("openContent")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("openContent")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <Toast toast={toast} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            // Board-shaped skeleton — matches the default Board layout so there's
            // no layout shift when content loads.
            <div className="space-y-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-5 w-44 rounded bg-neutral-200" />
                <div className="h-3 w-72 rounded bg-neutral-100" />
              </div>
              <div className="h-9 w-56 rounded-md bg-neutral-100" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, col) => (
                  <div key={col} className="rounded-md ring-1 ring-neutral-200/70 bg-neutral-50/60 min-h-40">
                    <div className="px-3 py-2.5 border-b border-neutral-200/70">
                      <div className="h-3 w-20 rounded bg-neutral-200" />
                    </div>
                    <div className="p-2 space-y-2">
                      {Array.from({ length: 3 - (col % 2) }).map((_, i) => (
                        <div key={i} className="h-9 rounded bg-white ring-1 ring-neutral-200/70" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <SocialCalendarView
              contentPosts={contentPosts}
              onOpenPost={handleOpenContentPost}
              onAddPost={handleAddContentPost}
              onMovePost={handleMoveContentPost}
              onBulkDelete={handleBulkDeleteContentPosts}
            />
          )}
        </div>

        <ContentDetailDrawer
          open={showContentPostForm}
          post={editingContentPost}
          isSaving={isSavingContentPost}
          onClose={closeContentDrawer}
          onSave={handleSaveContentPost}
          onDelete={editingContentPost ? handleDeleteContentPost : undefined}
          canReview={canReview}
          onDecided={() => {
            closeContentDrawer()
            loadContentPosts()
          }}
        />
      </div>
    </AdminRoleGuard>
  )
}

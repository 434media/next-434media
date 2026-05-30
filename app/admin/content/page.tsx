"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
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
  } = useContentPostHandlers({ setToast })

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
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <Toast toast={toast} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Loading content…</span>
              </div>
            </div>
          ) : (
            <SocialCalendarView
              contentPosts={contentPosts}
              onOpenPost={handleOpenContentPost}
              onAddPost={handleAddContentPost}
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

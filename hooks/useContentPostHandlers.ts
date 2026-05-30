"use client"

import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import type { ContentPost, Toast as ToastType } from "../components/crm/types"

// Content-post (Social Calendar) state + handlers, extracted from
// useClientHandlers so the standalone /admin/content surface can own this
// workflow without dragging in client/opportunity logic.
//
// Unlike the original (which lived inside the CRM page and flipped
// `setViewMode("social-calendar")` to reveal the calendar tab), this hook is
// self-contained: the content page *is* the calendar, so there's no view to
// switch. The hook owns all content-post state internally and exposes the
// pieces the page needs (list, drawer state, save/delete, deep-link open).

interface UseContentPostHandlersProps {
  setToast: Dispatch<SetStateAction<ToastType | null>>
}

export function useContentPostHandlers({ setToast }: UseContentPostHandlersProps) {
  const [contentPosts, setContentPosts] = useState<ContentPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingContentPost, setEditingContentPost] = useState<ContentPost | null>(null)
  const [showContentPostForm, setShowContentPostForm] = useState(false)
  const [isSavingContentPost, setIsSavingContentPost] = useState(false)

  const loadContentPosts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/crm/content-posts")
      if (!response.ok) throw new Error("Failed to load content posts")
      const data = await response.json()
      setContentPosts(data.posts || [])
    } catch {
      setToast({ message: "Failed to load content posts", type: "error" })
    } finally {
      setIsLoading(false)
    }
  }, [setToast])

  const handleAddContentPost = useCallback(() => {
    setEditingContentPost(null)
    setShowContentPostForm(true)
  }, [])

  const handleOpenContentPost = useCallback((post: ContentPost) => {
    setEditingContentPost(post)
    setShowContentPostForm(true)
  }, [])

  // Open a specific post by id — used by the notification handoff, where the
  // posts array may not be loaded yet. Fetches on demand, then opens the drawer.
  const handleOpenContentPostFromNotification = useCallback(
    async (postId: string) => {
      let posts = contentPosts
      if (posts.length === 0) {
        try {
          const response = await fetch("/api/admin/crm/content-posts")
          if (response.ok) {
            const data = await response.json()
            posts = data.posts || []
            setContentPosts(posts)
          }
        } catch {
          /* ignore — handled by the not-found branch below */
        }
      }

      const post = posts.find((p) => p.id === postId)
      if (post) {
        setEditingContentPost(post)
        setShowContentPostForm(true)
      } else {
        setToast({ message: "Could not find the content post", type: "error" })
      }
    },
    [contentPosts, setToast],
  )

  const handleSaveContentPost = useCallback(
    async (postData: Partial<ContentPost>) => {
      setIsSavingContentPost(true)
      try {
        if (editingContentPost) {
          const response = await fetch(
            `/api/admin/crm/content-posts?id=${editingContentPost.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(postData),
            },
          )
          if (!response.ok) throw new Error("Failed to update content post")
          const data = await response.json()
          setContentPosts((prev) =>
            prev.map((p) => (p.id === editingContentPost.id ? data.post : p)),
          )
          setToast({ message: "Content post updated successfully", type: "success" })
        } else {
          const response = await fetch("/api/admin/crm/content-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: postData.user || "",
              date_created: new Date().toISOString(),
              platform: postData.platform,
              status: postData.status || "to_do",
              title: postData.title || "",
              date_to_post: postData.date_to_post,
              notes: postData.notes,
              thumbnail: postData.thumbnail,
              social_copy: postData.social_copy,
              links: postData.links || [],
              assets: postData.assets || [],
              tags: postData.tags,
              social_platforms: postData.social_platforms || [],
              comments: postData.comments || [],
            }),
          })
          if (!response.ok) throw new Error("Failed to create content post")
          const data = await response.json()
          setContentPosts((prev) => [...prev, data.post])
          setToast({ message: "Content post created successfully", type: "success" })
        }
        setShowContentPostForm(false)
        setEditingContentPost(null)
      } catch {
        setToast({
          message: `Failed to ${editingContentPost ? "update" : "create"} content post`,
          type: "error",
        })
      } finally {
        setIsSavingContentPost(false)
      }
    },
    [editingContentPost, setToast],
  )

  const handleDeleteContentPost = useCallback(
    async (postId: string) => {
      try {
        const response = await fetch(`/api/admin/crm/content-posts?id=${postId}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete content post")
        setContentPosts((prev) => prev.filter((p) => p.id !== postId))
        setShowContentPostForm(false)
        setEditingContentPost(null)
        setToast({ message: "Content post deleted successfully", type: "success" })
      } catch {
        setToast({ message: "Failed to delete content post", type: "error" })
      }
    },
    [setToast],
  )

  return {
    contentPosts,
    setContentPosts,
    isLoading,
    loadContentPosts,
    editingContentPost,
    setEditingContentPost,
    showContentPostForm,
    setShowContentPostForm,
    isSavingContentPost,
    handleAddContentPost,
    handleOpenContentPost,
    handleOpenContentPostFromNotification,
    handleSaveContentPost,
    handleDeleteContentPost,
  }
}

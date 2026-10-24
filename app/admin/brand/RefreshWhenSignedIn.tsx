"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Rendered by the server when the request had no session. The admin layout
// shows its sign-in form instead of the page, and only mounts this once the
// visitor signs in, without a navigation. Refreshing then re-renders the page
// on the server with the new session cookie.
export default function RefreshWhenSignedIn() {
  const router = useRouter()
  useEffect(() => {
    router.refresh()
  }, [router])
  return null
}

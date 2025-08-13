"use client"

import type React from "react"

import { useState, useEffect } from "react"
import AdminPasswordModal from "../components/AdminPasswordModal"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing admin session
    const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (adminKey) {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handlePasswordVerified = (password: string) => {
    sessionStorage.setItem("adminKey", password)
    setIsAuthenticated(true)
  }

  const handlePasswordCancel = () => {
    window.location.href = "/"
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <AdminPasswordModal
          isOpen={true}
          onVerified={handlePasswordVerified}
          onCancel={handlePasswordCancel}
          action="access the admin dashboard"
        />
      </div>
    )
  }

  return <>{children}</>
}

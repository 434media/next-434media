"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, AlertCircle } from "lucide-react"

type AdminRole = 'full_admin' | 'crm_only'

interface User {
  email: string
  name: string
  picture?: string
  role?: AdminRole
  authProvider?: 'google' | 'firebase'
}

interface AdminRoleGuardProps {
  children: React.ReactNode
  allowedRoles: AdminRole[]
  fallbackUrl?: string
}

/**
 * Component that protects admin pages based on user role.
 * Redirects users without proper access to the admin home or fallback URL.
 */
export function AdminRoleGuard({ 
  children, 
  allowedRoles,
  fallbackUrl = "/admin"
}: AdminRoleGuardProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const response = await fetch("/api/auth/session")
      if (!response.ok) {
        router.push("/admin")
        return
      }

      const data = await response.json()
      if (!data.authenticated || !data.user) {
        router.push("/admin")
        return
      }

      setUser(data.user)
      
      // Check if user's role is in allowed roles
      const userRole: AdminRole = data.user.role || 'crm_only'
      const canAccess = allowedRoles.includes(userRole)
      
      setHasAccess(canAccess)
      
      if (!canAccess) {
        // Small delay to show access denied message
        setTimeout(() => {
          router.push(fallbackUrl)
        }, 2000)
      }
    } catch (error) {
      console.error("Failed to check access:", error)
      router.push("/admin")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-600">Loading...</div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access Restricted</h2>
          <p className="text-neutral-500 mb-4">
            You don&apos;t have permission to access this section.
            {user?.role === 'crm_only' && (
              <span className="block mt-2 text-sm">
                Your account has access to the CRM only.
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
            <AlertCircle className="w-4 h-4" />
            <span>Redirecting to admin home...</span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Hook to check if current user has access to a section
 */
export function useAdminAccess(allowedRoles: AdminRole[]) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const data = await response.json()
          if (data.authenticated && data.user) {
            setUser(data.user)
            const userRole: AdminRole = data.user.role || 'crm_only'
            setHasAccess(allowedRoles.includes(userRole))
          }
        }
      } catch (error) {
        console.error("Failed to check access:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [allowedRoles])

  return { user, isLoading, hasAccess }
}

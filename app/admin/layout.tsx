"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Shield, AlertCircle, Mail, Lock, Loader2 } from "lucide-react"
import { NotificationProvider } from "../context/notification-context"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "../lib/firebase"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ email: string; name: string; picture?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Email/Password form state
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isEmailLoading, setIsEmailLoading] = useState(false)

  useEffect(() => {
    // Check for existing session
    checkSession()
    
    // Check for OAuth errors in URL
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      setError(getErrorMessage(errorParam))
      // Clean up URL
      window.history.replaceState({}, '', '/admin')
    }
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setIsAuthenticated(data.authenticated)
        setUser(data.user || null)
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to check session:', error)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = () => {
    window.location.href = '/api/auth/signin/google'
  }

  const handleCancel = () => {
    window.location.href = "/"
  }

  const getErrorMessage = (errorCode: string): string => {
    const errors: Record<string, string> = {
      'unauthorized_domain': 'Access denied. Only 434 Media workspace accounts are allowed.',
      'unauthorized_email': 'This email is not authorized to access the admin area.',
      'email_not_verified': 'Your email address must be verified.',
      'authentication_failed': 'Authentication failed. Please try again.',
      'invalid_state': 'Invalid session. Please try again.',
      'oauth_not_configured': 'OAuth is not properly configured.',
      'access_denied': 'Access was denied.',
      'invalid_credentials': 'Invalid email or password.',
      'too_many_requests': 'Too many failed attempts. Please try again later.',
    }
    return errors[errorCode] || 'An error occurred during sign in.'
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsEmailLoading(true)

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // Get the ID token
      const idToken = await userCredential.user.getIdToken()
      
      // Send to our API to verify and create session
      const response = await fetch('/api/auth/signin/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(getErrorMessage(data.error || 'authentication_failed'))
        return
      }

      // Session created successfully, refresh
      setIsAuthenticated(true)
      setUser(data.user)
    } catch (err: unknown) {
      console.error('Email sign in error:', err)
      
      // Handle Firebase auth errors
      const firebaseError = err as { code?: string }
      if (firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/user-not-found') {
        setError(getErrorMessage('invalid_credentials'))
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setError(getErrorMessage('too_many_requests'))
      } else if (firebaseError.code === 'auth/invalid-credential') {
        setError(getErrorMessage('invalid_credentials'))
      } else {
        setError(getErrorMessage('authentication_failed'))
      }
    } finally {
      setIsEmailLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-neutral-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-950 to-slate-900 rounded-full mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
              <p className="text-gray-300 text-sm">
                Sign in to access the admin dashboard
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {!showEmailForm ? (
              <>
                {/* Google Sign In Button */}
                <button
                  onClick={handleSignIn}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl mb-4"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Sign in with Google Workspace</span>
                </button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-transparent text-gray-400">or</span>
                  </div>
                </div>

                {/* Email/Password Option */}
                <button
                  onClick={() => setShowEmailForm(true)}
                  className="w-full bg-transparent hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 border border-white/20 mb-4"
                >
                  <Mail className="w-5 h-5" />
                  <span>Sign in with Email</span>
                </button>

                {/* Cancel Button */}
                <button
                  onClick={handleCancel}
                  className="w-full bg-transparent hover:bg-white/10 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-white/20"
                >
                  Cancel
                </button>

                {/* Info */}
                <p className="text-xs text-gray-400 text-center mt-6">
                  434 Media workspace accounts or authorized emails only
                </p>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isEmailLoading}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEmailLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>

                {/* Back to options */}
                <button
                  onClick={() => {
                    setShowEmailForm(false)
                    setError(null)
                    setEmail("")
                    setPassword("")
                  }}
                  className="w-full mt-4 bg-transparent hover:bg-white/10 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-white/20"
                >
                  Back to sign in options
                </button>

                {/* Info */}
                <p className="text-xs text-gray-400 text-center mt-6">
                  Use the email and password provided by 434 Media
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <NotificationProvider>
      <div className="w-full max-w-full">{children}</div>
    </NotificationProvider>
  )
}

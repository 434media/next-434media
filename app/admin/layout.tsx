"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Shield, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { 
  signInWithGoogle, 
  signInWithEmail, 
  signOut, 
  onAuthStateChange,
  getIdToken,
  isWorkspaceDomainEmail,
  checkRedirectResult,
  isMobileDevice
} from "@/app/lib/firebase-client"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ email: string; name: string; picture?: string; authProvider?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true)

  useEffect(() => {
    // Check for existing session first
    checkSession()
    
    // Check for redirect result (for mobile Google sign-in)
    handleRedirectResult()
    
    // Check for OAuth errors in URL
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      setError(getErrorMessage(errorParam))
      // Clean up URL
      window.history.replaceState({}, '', '/admin')
    }
  }, [])

  // Handle redirect result from mobile Google sign-in
  const handleRedirectResult = async () => {
    try {
      const result = await checkRedirectResult()
      if (result?.user) {
        // Verify workspace domain for Google users
        if (!result.user.email || !isWorkspaceDomainEmail(result.user.email)) {
          await signOut()
          setError('Only 434 Media workspace accounts are allowed for Google sign-in.')
          setIsCheckingRedirect(false)
          return
        }
        
        // Create server session
        await createServerSession('google')
      }
    } catch (err: any) {
      console.error('Redirect result error:', err)
      // Only show error if it's not a cancelled/empty redirect
      if (err.code && err.code !== 'auth/popup-closed-by-user') {
        setError(getErrorMessage(err.message || 'authentication_failed'))
      }
    } finally {
      setIsCheckingRedirect(false)
    }
  }

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

  // Create server session from Firebase token
  const createServerSession = async (authProvider: string) => {
    try {
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get ID token')
      }

      const response = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, authProvider }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'authentication_failed')
      }

      setIsAuthenticated(true)
      setUser(data.user)
      setError(null)
    } catch (err: any) {
      console.error('Session creation error:', err)
      // Sign out from Firebase if server session creation fails
      await signOut()
      throw err
    }
  }

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true)
    setError(null)
    
    try {
      // On mobile, this will redirect - the result is handled in handleRedirectResult
      const firebaseUser = await signInWithGoogle()
      
      // This code only runs on desktop (popup flow)
      // Verify workspace domain for Google users
      if (!firebaseUser.email || !isWorkspaceDomainEmail(firebaseUser.email)) {
        await signOut()
        setError('Only 434 Media workspace accounts are allowed for Google sign-in.')
        return
      }

      await createServerSession('google')
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      // Ignore redirect message (expected on mobile)
      if (err.message === 'Redirecting...') {
        return
      }
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show error
        return
      }
      if (err.code === 'auth/popup-blocked') {
        // Popup was blocked - suggest mobile flow
        setError('Pop-up was blocked by your browser. Please allow pop-ups or try on a mobile device.')
        return
      }
      setError(getErrorMessage(err.message || 'authentication_failed'))
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSigningIn(true)
    setError(null)

    try {
      await signInWithEmail(email, password)
      await createServerSession('email')
    } catch (err: any) {
      console.error('Email sign-in error:', err)
      const errorMessages: Record<string, string> = {
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/user-disabled': 'This account has been disabled.',
      }
      setError(errorMessages[err.code] || 'Failed to sign in. Please try again.')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleCancel = () => {
    window.location.href = "/"
  }

  const getErrorMessage = (errorCode: string): string => {
    const errors: Record<string, string> = {
      'unauthorized_domain': 'Access denied. Only 434 Media workspace accounts are allowed for Google sign-in.',
      'email_not_verified': 'Your email address must be verified.',
      'authentication_failed': 'Authentication failed. Please try again.',
      'invalid_state': 'Invalid session. Please try again.',
      'oauth_not_configured': 'OAuth is not properly configured.',
      'access_denied': 'Access was denied.',
    }
    return errors[errorCode] || errorCode || 'An error occurred during sign in.'
  }

  if (isLoading || isCheckingRedirect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white mb-2">Loading...</div>
          {isCheckingRedirect && isMobileDevice() && (
            <div className="text-gray-400 text-sm">Completing sign-in...</div>
          )}
        </div>
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
                Sign in with your 434 Media workspace account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {/* Auth Mode Tabs */}
            <div className="flex mb-6 bg-white/5 rounded-lg p-1">
              <button
                onClick={() => { setAuthMode('google'); setError(null) }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  authMode === 'google'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Google Workspace
              </button>
              <button
                onClick={() => { setAuthMode('email'); setError(null) }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  authMode === 'email'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Email / Password
              </button>
            </div>

            {authMode === 'google' ? (
              <>
                {/* Google Sign In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSigningIn ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
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
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>

                {/* Info for Google */}
                <p className="text-xs text-gray-400 text-center mb-4">
                  Only @434media.com workspace accounts can use Google sign-in
                </p>
              </>
            ) : (
              <>
                {/* Email/Password Form */}
                <form onSubmit={handleEmailSignIn} className="space-y-4 mb-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full bg-white/10 border border-white/20 rounded-lg py-3 pl-10 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSigningIn}
                    className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSigningIn ? 'Signing in...' : 'Sign in with Email'}
                  </button>
                </form>

                {/* Info for Email */}
                <p className="text-xs text-gray-400 text-center mb-4">
                  For approved external administrators only
                </p>
              </>
            )}

            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              className="w-full bg-transparent hover:bg-white/10 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200 border border-white/20"
            >
              Cancel
            </button>

            {/* Info */}
            <p className="text-xs text-gray-400 text-center mt-6">
              Admin access is restricted to authorized personnel
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <div className="w-full max-w-full">{children}</div>
}

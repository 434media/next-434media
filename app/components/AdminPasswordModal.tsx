"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Shield, Eye, EyeOff, Lock, CheckCircle, AlertTriangle, X, Sparkles } from "lucide-react"

interface AdminPasswordModalProps {
  isOpen: boolean
  onVerified: (password: string) => void
  onCancel: () => void
  action: string
  itemName?: string
}

export default function AdminPasswordModal({
  isOpen,
  onVerified,
  onCancel,
  action,
  itemName,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState("")
  const [attempts, setAttempts] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword("")
      setError("")
      setAttempts(0)
      setShowPassword(false)
      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isVerifying) {
        onCancel()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, isVerifying, onCancel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setError("Please enter the admin password")
      return
    }

    setIsVerifying(true)
    setError("")

    try {
      // Verify password on server (now checks both admin and intern passwords)
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Invalid password")
      }

      // Password verified successfully (either admin or intern)
      onVerified(password)
      setPassword("")
    } catch (error) {
      setAttempts((prev) => prev + 1)
      setError(error instanceof Error ? error.message : "Invalid admin or intern password")
      setPassword("")

      // Shake animation on error
      inputRef.current?.classList.add("animate-shake")
      setTimeout(() => {
        inputRef.current?.classList.remove("animate-shake")
      }, 500)
    } finally {
      setIsVerifying(false)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (error) setError("") // Clear error when typing
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Enhanced Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
        {/* Floating particles for visual interest */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-400/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-blue-400/10 rounded-full blur-lg animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-yellow-400/10 rounded-full blur-md animate-pulse delay-500"></div>
        </div>
      </div>

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4">
          {/* Main Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm overflow-hidden">
            {/* Gradient Header */}
            <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 p-6 text-white">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>

              <div className="relative flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Admin Verification</h3>
                  <p className="text-purple-100 text-sm">Secure access required</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Action Description */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Action Required</span>
                </div>
                <p className="text-gray-600">
                  Enter your admin or intern password to <span className="font-semibold text-gray-900">{action}</span>
                  {itemName && (
                    <>
                      {" "}
                      for <span className="font-semibold text-purple-600">"{itemName}"</span>
                    </>
                  )}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Password Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin/Intern Password</label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      className={`w-full px-4 py-3 pr-12 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                        error ? "border-red-300 bg-red-50" : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      placeholder="Enter admin or intern password..."
                      disabled={isVerifying}
                      autoComplete="current-password"
                    />

                    {/* Show/Hide Password Button */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      disabled={isVerifying}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mt-2 flex items-center gap-2 text-red-600 animate-in slide-in-from-top-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  {/* Attempts Warning */}
                  {attempts > 0 && (
                    <div className="mt-2 text-xs text-amber-600">
                      {attempts === 1 && "Please check your password and try again."}
                      {attempts === 2 && "⚠️ Multiple failed attempts detected."}
                      {attempts >= 3 && "🚨 Too many failed attempts. Please contact administrator."}
                    </div>
                  )}
                </div>

                {/* Security Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-700">
                      <p className="font-medium mb-1">Security Notice</p>
                      <p>This action requires admin or intern privileges to prevent unauthorized access.</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isVerifying}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifying || !password.trim() || attempts >= 3}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 disabled:hover:scale-100"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Verify & Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <Sparkles className="w-3 h-3" />
                  <span>434 Media Admin Portal</span>
                  <Sparkles className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onCancel}
            disabled={isVerifying}
            className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

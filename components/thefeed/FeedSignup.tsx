"use client"

import type React from "react"
import { useState } from "react"

// Footer signup on a Feed post. Posts to /api/thefeed-newsletter, which tags the
// subscriber to Digital Canvas as the Digital Canvas site's own signup did.
export function FeedSignup() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const response = await fetch("/api/thefeed-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (response.ok) {
        setIsSuccess(true)
        setEmail("")
      } else {
        const data = await response.json().catch(() => ({}))
        setError(data.error || "Failed to subscribe. Please try again.")
      }
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <footer className="mt-16 pt-10 border-t border-gray-200">
      <div className="bg-gray-900 text-white p-8 md:p-10 rounded-sm">
        {isSuccess ? (
          <div className="text-center py-4" role="status">
            <h2 className="text-2xl font-bold mb-2">You&apos;re subscribed</h2>
            <p className="text-gray-400 text-sm">Check your inbox for confirmation.</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">Stay Updated</h2>
            <p className="mb-6 text-gray-400 text-sm md:text-base leading-relaxed">
              New posts from The Feed, in your inbox when there&apos;s something worth saying.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label htmlFor="feed-signup-email" className="sr-only">Email</label>
              <input
                id="feed-signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
                autoComplete="email"
                className="w-full px-4 py-3 bg-white text-gray-900 rounded-sm focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 text-sm font-medium placeholder:text-gray-400"
              />
              {error && <p className="text-sm text-[#D0271D] text-left">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-white text-gray-900 text-sm font-semibold tracking-wide hover:bg-gray-100 transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
          </div>
        )}
      </div>
    </footer>
  )
}

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
    <footer className="mt-16 pt-10 border-t border-neutral-200">
      <div className="bg-[var(--color-chrome-bg)] text-[var(--color-on-dark-text)] p-8 md:p-10">
        {isSuccess ? (
          <div className="text-center py-4" role="status">
            <h2 className="t-heading-l mb-2">You&apos;re subscribed</h2>
            <p className="t-body-s text-[var(--color-on-dark-text-secondary)]">Check your inbox for confirmation.</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center">
            <h2 className="t-heading-l mb-3">Stay updated</h2>
            <p className="t-body mb-6 text-[var(--color-on-dark-text-secondary)]">
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
                className="t-control w-full px-4 py-3 bg-[var(--434-white)] text-[var(--434-color-02-black)] focus:outline-none focus:ring-2 focus:ring-[var(--434-color-05)] disabled:opacity-50 placeholder:text-neutral-500"
              />
              {error && <p className="t-body-s text-[var(--color-fn-error)] text-left">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="t-control-emphasis w-full px-6 py-3 bg-[var(--434-white)] text-[var(--434-color-02-black)] hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

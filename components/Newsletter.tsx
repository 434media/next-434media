"use client"

import type React from "react"
import { useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"

export function Newsletter() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Email validation regex pattern
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  const validateEmail = (email: string): boolean => {
    return emailPattern.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset previous states
    setError(null)

    // Validate email
    if (!email.trim()) {
      setError("Please enter your email address")
      inputRef.current?.focus()
      return
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const responseData = await response.json()

      if (response.ok) {
        setEmail("")
        setIsSuccess(true)

        // Reset form
        formRef.current?.reset()

        // Reset success state after 5 seconds
        setTimeout(() => setIsSuccess(false), 5000)
      } else {
        throw new Error(responseData.error || "Newsletter subscription failed")
      }
    } catch (error) {
      console.error("Error subscribing to newsletter:", error)
      setError(`${error instanceof Error ? error.message : "An unexpected error occurred"}. Please try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <AnimatePresence mode="wait">
        {!isSuccess ? (
          <motion.form
            ref={formRef}
            key="subscribe-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="newsletter-form"
            aria-label="Newsletter subscription form"
          >
            <div className="relative flex items-center">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                ref={inputRef}
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="font-geist-sans w-full pr-14 px-4 py-3 bg-neutral-900 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30 text-white text-sm placeholder-neutral-500 transition-colors"
                aria-describedby={error ? "newsletter-error" : undefined}
                disabled={isSubmitting}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="absolute right-1.5 bg-white text-neutral-950 w-9 h-9 rounded-md flex items-center justify-center hover:bg-neutral-200 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-white"
                aria-label="Subscribe to newsletter"
              >
                <motion.div
                  animate={isSubmitting ? { rotate: 360 } : { rotate: 0 }}
                  transition={isSubmitting ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" } : {}}
                >
                  {isSubmitting ? <LoadingIcon className="h-4 w-4" /> : <ArrowIcon className="h-4 w-4" />}
                </motion.div>
              </button>
            </div>

            {error && (
              <div id="newsletter-error" className="font-geist-sans text-red-400 text-xs mt-2 px-1" role="alert">
                {error}
              </div>
            )}
          </motion.form>
        ) : (
          <motion.div
            key="success-message"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-neutral-900 border border-white/10 px-4 py-3 rounded-lg text-white text-sm text-center font-geist-sans"
            role="status"
            aria-live="polite"
          >
            Thanks for subscribing! We&apos;ll be in touch soon.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5 12H19M19 12L12 5M19 12L12 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
)


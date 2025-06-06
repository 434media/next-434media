"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import Image from "next/image"

// Extend the Window interface to include the turnstile property
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          "refresh-expired"?: "auto" | "manual"
        },
      ) => string
      getResponse: (widgetId: string) => string | null
      reset: (widgetId: string) => void
    }
  }
}

const isDevelopment = process.env.NODE_ENV === "development"

interface TXMXNewsletterProps {
  showModal: boolean
  onClose: () => void
}

export default function TXMXNewsletter({ showModal, onClose }: TXMXNewsletterProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const [turnstileWidget, setTurnstileWidget] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Email validation regex pattern
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  // Load Turnstile script only when needed
  useEffect(() => {
    if (isDevelopment || turnstileWidget || !showModal) return

    const loadTurnstile = () => {
      if (document.getElementById("turnstile-script")) return

      const script = document.createElement("script")
      script.id = "turnstile-script"
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
      script.async = true
      script.defer = true
      document.body.appendChild(script)

      script.onload = () => {
        if (window.turnstile && turnstileRef.current) {
          const widgetId = window.turnstile.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
            callback: () => {
              // Token received, no action needed here
            },
            "refresh-expired": "auto",
          })
          setTurnstileWidget(widgetId)
        }
      }
    }

    loadTurnstile()

    return () => {
      // Clean up widget when component unmounts
      if (turnstileWidget && window.turnstile) {
        try {
          window.turnstile.reset(turnstileWidget)
        } catch (error) {
          console.error("Error resetting Turnstile widget:", error)
        }
      }
    }
  }, [turnstileWidget, showModal])

  const validateEmail = (email: string): boolean => {
    return emailPattern.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset previous states
    setError(null)

    // Validate email
    if (!email.trim()) {
      setError("Enter your email to join the fight")
      inputRef.current?.focus()
      return
    }

    if (!validateEmail(email)) {
      setError("Enter a valid email address")
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      let turnstileResponse = undefined

      if (!isDevelopment) {
        if (!window.turnstile || !turnstileWidget) {
          throw new Error("Security verification not loaded. Please refresh and try again.")
        }

        turnstileResponse = window.turnstile.getResponse(turnstileWidget)
        if (!turnstileResponse) {
          throw new Error("Please complete the security verification")
        }
      }

      const response = await fetch("/api/txmx-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileResponse && { "cf-turnstile-response": turnstileResponse }),
        },
        body: JSON.stringify({ email }),
      })

      const responseData = await response.json()

      if (response.ok) {
        setEmail("")
        setIsSuccess(true)

        // Reset form
        formRef.current?.reset()

        // Reset success state and close modal after 3 seconds
        setTimeout(() => {
          setIsSuccess(false)
          onClose()
        }, 3000)

        // Reset Turnstile if needed
        if (!isDevelopment && turnstileWidget && window.turnstile) {
          window.turnstile.reset(turnstileWidget)
        }
      } else {
        throw new Error(responseData.error || "Failed to join the fight")
      }
    } catch (error) {
      console.error("Error subscribing to TXMX newsletter:", error)
      setError(`${error instanceof Error ? error.message : "An unexpected error occurred"}. Try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!showModal) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white border-4 border-black shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black text-white hover:bg-gray-800 transition-colors"
            aria-label="Close newsletter signup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-8">
            {/* Header with Logo */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-4"
              >
                <div className="flex justify-center mb-4">
                  <Image
                    src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg"
                    alt="TXMX Boxing Logo"
                    width={120}
                    height={60}
                    className="filter invert"
                    priority
                  />
                </div>
                <div className="h-1 w-16 bg-black mx-auto mb-4"></div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <p className="text-lg font-bold text-black italic">Levantamos Los Puños</p>
              </motion.div>
            </div>

            {/* Value Proposition */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-6"
            >
              <p className="text-sm text-gray-700 leading-relaxed">
                Get exclusive drops, insider access, and be first in the ring for limited releases.
              </p>
            </motion.div>

            {/* Form */}
            <AnimatePresence mode="wait">
              {!isSuccess ? (
                <motion.form
                  ref={formRef}
                  key="subscribe-form"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  aria-label="TXMX Newsletter subscription form"
                >
                  <div className="relative">
                    <label htmlFor="txmx-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="txmx-email"
                      ref={inputRef}
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 border-2 border-black bg-white text-black placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
                      aria-describedby={error ? "newsletter-error" : undefined}
                      disabled={isSubmitting}
                      autoComplete="email"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-black text-white py-3 px-6 font-bold text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    aria-label="Join TXMX newsletter"
                  >
                    <motion.div
                      animate={isSubmitting ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={isSubmitting ? { duration: 1, repeat: Number.POSITIVE_INFINITY } : {}}
                      className="flex items-center justify-center"
                    >
                      {isSubmitting ? "JOINING THE FIGHT..." : "JOIN THE FIGHT"}
                    </motion.div>
                  </button>

                  {!isDevelopment && (
                    <div
                      ref={turnstileRef}
                      data-theme="light"
                      data-size="compact"
                      className="w-full flex justify-center"
                      aria-label="Security verification"
                    />
                  )}

                  {error && (
                    <div id="newsletter-error" className="text-red-600 text-sm text-center font-medium" role="alert">
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
                  className="text-center py-8"
                  role="status"
                  aria-live="polite"
                >
                  <div className="mb-4">
                    <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", damping: 15 }}
                      >
                        <CheckIcon className="h-8 w-8 text-white" />
                      </motion.div>
                    </div>
                    <h3 className="text-xl font-bold text-black mb-2">Welcome to the Fight!</h3>
                    <p className="text-gray-700 text-sm">
                      You're now part of the TXMX family. Get ready for exclusive drops and insider access.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

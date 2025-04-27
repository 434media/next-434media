"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useMobile } from "../hooks/use-mobile"
import type { Locale } from "../../i18n-config"

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

interface SDOHNewsletterProps {
  locale: Locale
  dict: any
}

export function SDOHNewsletter({ locale, dict }: SDOHNewsletterProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const [turnstileWidget, setTurnstileWidget] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMobile()

  // Use the dictionary if provided, otherwise use default English text
  const d = dict?.newsletter || {
    placeholder: "Enter your email",
    buttonText: "Subscribe",
    successMessage: "Thanks for subscribing to the SDOH newsletter! We'll be in touch soon.",
    errorMessage: "Please enter a valid email address",
    securityError: "Security verification not loaded. Please refresh and try again.",
    completeVerification: "Please complete the security verification",
  }

  // Load Turnstile script only when needed
  useEffect(() => {
    if (isDevelopment || turnstileWidget) return

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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  }, [turnstileWidget])

  // Email validation regex pattern
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0.9.-]+\.[a-zA-Z]{2,}$/

  const validateEmail = (email: string): boolean => {
    return emailPattern.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset previous states
    setError(null)

    // Validate email
    if (!email.trim()) {
      setError(d.errorMessage || "Please enter your email address")
      inputRef.current?.focus()
      return
    }

    if (!validateEmail(email)) {
      setError(d.errorMessage || "Please enter a valid email address")
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      let turnstileResponse = undefined

      if (!isDevelopment) {
        if (!window.turnstile || !turnstileWidget) {
          throw new Error(d.securityError || "Security verification not loaded. Please refresh and try again.")
        }

        turnstileResponse = window.turnstile.getResponse(turnstileWidget)
        if (!turnstileResponse) {
          throw new Error(d.completeVerification || "Please complete the security verification")
        }
      }

      // Send data to the API - Fixed URL by removing "/route"
      const response = await fetch("/api/sdoh-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileResponse && { "cf-turnstile-response": turnstileResponse }),
        },
        body: JSON.stringify({
          email,
          source: "SDOH",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to subscribe to newsletter")
      }

      setEmail("")
      setIsSuccess(true)

      // Reset form
      formRef.current?.reset()

      // Reset Turnstile if needed
      if (!isDevelopment && turnstileWidget && window.turnstile) {
        window.turnstile.reset(turnstileWidget)
      }

      // Reset success state after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000)
    } catch (error) {
      console.error("Error subscribing to newsletter:", error)
      setError(`${error instanceof Error ? error.message : "An unexpected error occurred"}. Please try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full" id="newsletter">
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
            aria-label="SDOH Newsletter subscription form"
          >
            <div className="relative flex flex-col sm:flex-row items-center overflow-hidden rounded-lg bg-white/10 border border-white/20 shadow-lg focus-within:ring-2 focus-within:ring-white/50">
              <label htmlFor="sdoh-email" className="sr-only">
                Email address
              </label>
              <input
                id="sdoh-email"
                ref={inputRef}
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={d.placeholder || "Enter your email"}
                className="w-full px-4 py-3 sm:py-4 bg-transparent focus:outline-none text-white text-sm sm:text-base placeholder-white/70"
                aria-describedby={error ? "newsletter-error" : undefined}
                disabled={isSubmitting}
                autoComplete="email"
              />
              <div className={`${isMobile ? "w-full mt-2 px-4 pb-4" : "absolute right-2"}`}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`${isMobile ? "w-full" : "w-auto px-4 h-10"} bg-white text-neutral-700 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-700 py-2 px-4`}
                  aria-label="Subscribe to SDOH newsletter"
                >
                  <motion.div
                    animate={isSubmitting ? { rotate: 360 } : { rotate: 0 }}
                    transition={isSubmitting ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" } : {}}
                    className="flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <LoadingIcon className="h-5 w-5" />
                    ) : (
                      <>
                        {isMobile ? (
                          <span className="flex items-center">
                            {d.buttonText || "Subscribe"} <ArrowIcon className="h-5 w-5 ml-2" />
                          </span>
                        ) : (
                          <span className="flex items-center">
                            {d.buttonText || "Subscribe"} <ArrowIcon className="h-5 w-5 ml-2" />
                          </span>
                        )}
                      </>
                    )}
                  </motion.div>
                </button>
              </div>
            </div>

            {!isDevelopment && (
              <div
                ref={turnstileRef}
                data-theme="dark"
                data-size="compact"
                className="w-full mt-4 flex justify-center"
                aria-label="Security verification"
              />
            )}

            {error && (
              <div id="newsletter-error" className="text-white/90 text-sm mt-2 px-2" role="alert">
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
            className="mt-6 bg-white/20 border border-white/30 px-4 sm:px-6 py-4 rounded-lg flex items-center shadow-lg"
            role="status"
            aria-live="polite"
          >
            <div className="bg-neutral-500 rounded-full p-1 mr-3 flex-shrink-0">
              <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-white text-sm sm:text-base font-medium">
              {d.successMessage || "Thanks for subscribing to the SDOH newsletter! We'll be in touch soon."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 5L20 12L13 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

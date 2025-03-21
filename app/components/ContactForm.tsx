"use client"

import { useState, useRef, useEffect, type FormEvent } from "react"
import { motion, AnimatePresence } from "motion/react"

// Define the global interface for window.turnstile
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

interface ContactFormProps {
  className?: string
  isVisible?: boolean
}

export function ContactForm({ className = "", isVisible = true }: ContactFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const [turnstileWidget, setTurnstileWidget] = useState<string | null>(null)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.2 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.5 } },
  }

  const successVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.5 } },
  }

  const isDevelopment = process.env.NODE_ENV === "development"

  // Load Turnstile script
  useEffect(() => {
    if (isDevelopment || turnstileLoaded) return

    const loadTurnstile = () => {
      if (document.getElementById("turnstile-script")) {
        setTurnstileLoaded(true)
        return
      }

      const script = document.createElement("script")
      script.id = "turnstile-script"
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log("Turnstile script loaded")
        setTurnstileLoaded(true)
      }
      script.onerror = (error) => {
        console.error("Error loading Turnstile script:", error)
      }
      document.body.appendChild(script)
    }

    loadTurnstile()
  }, [isDevelopment, turnstileLoaded])

  // Initialize Turnstile widget when visible
  useEffect(() => {
    if (isDevelopment || !isVisible || !turnstileLoaded || !window.turnstile || turnstileWidget) return

    // Small delay to ensure the DOM is ready
    const timeoutId = setTimeout(() => {
      if (turnstileRef.current) {
        try {
          // Clear any existing content
          turnstileRef.current.innerHTML = ""

          console.log("Rendering Turnstile widget")
          const widgetId = window.turnstile?.render(turnstileRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
            callback: (_token: string) => {
              console.log("Turnstile token generated")
            },
            "refresh-expired": "auto",
          })
          console.log("Turnstile widget ID:", widgetId)
          if (widgetId) {
            setTurnstileWidget(widgetId)
          }
        } catch (error) {
          console.error("Error rendering Turnstile widget:", error)
        }
      } else {
        console.warn("Turnstile container ref not available")
      }
    }, 300)

    return () => {
      clearTimeout(timeoutId)
      // Clean up widget when component unmounts or becomes invisible
      if (turnstileWidget && window.turnstile) {
        try {
          window.turnstile?.reset(turnstileWidget)
          setTurnstileWidget(null)
        } catch (error) {
          console.error("Error resetting Turnstile widget:", error)
        }
      }
    }
  }, [isDevelopment, isVisible, turnstileLoaded, turnstileWidget])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Get form data
    const formData = new FormData(e.target as HTMLFormElement)
    const firstName = formData.get("firstName") as string
    const lastName = formData.get("lastName") as string
    const company = formData.get("company") as string
    const email = formData.get("email") as string
    const phoneNumber = formData.get("phoneNumber") as string
    const message = formData.get("message") as string

    // Validate required fields
    if (!firstName || !lastName || !company || !email) {
      setError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    try {
      let turnstileResponse = undefined

      if (!isDevelopment) {
        if (!window.turnstile) {
          throw new Error("Turnstile is not initialized")
        }

        if (turnstileWidget) {
          turnstileResponse = window.turnstile?.getResponse(turnstileWidget)
          if (!turnstileResponse) {
            throw new Error("Please complete the Turnstile challenge")
          }
        } else {
          throw new Error("Turnstile widget is not initialized")
        }
      }

      const response = await fetch("/api/contact-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileResponse && { "cf-turnstile-response": turnstileResponse }),
        },
        body: JSON.stringify({
          firstName,
          lastName,
          company,
          email,
          phoneNumber,
          message,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        setHasSubmitted(true)
        if (formRef.current) formRef.current.reset()

        // Reset success message after 5 seconds
        setTimeout(() => {
          setHasSubmitted(false)
        }, 5000)

        if (!isDevelopment && turnstileWidget && window.turnstile) {
          window.turnstile.reset(turnstileWidget)
        }
      } else {
        throw new Error(responseData.error || "Form submission failed")
      }
    } catch (error) {
      console.error("Error submitting form:", error)
      setError(`An error occurred: ${error instanceof Error ? error.message : String(error)}. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`bg-neutral-100 rounded-2xl lg:rounded-3xl p-6 lg:p-8 overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {hasSubmitted ? (
          <motion.div
            key="success"
            variants={successVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="py-8 flex items-center justify-center h-full"
          >
            <div className="text-center">
              <i className="ri-check-line mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-2 text-xl font-semibold text-neutral-900">Thanks for Connecting!</h3>
              <p className="mt-2 text-sm text-neutral-600">We'll be in touch soon.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" variants={formVariants} initial="hidden" animate="visible" exit="exit">
            <p className="text-sm text-neutral-600 mb-6 lg:mb-8">
              All fields marked with an asterisk (*) are required.
            </p>
            <form className="space-y-6" onSubmit={handleSubmit} ref={formRef} id="contact-form">
              <div className="grid grid-cols-1 gap-x-4 lg:gap-x-8 gap-y-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    required
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    required
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="company" className="block text-sm font-medium text-neutral-700">
                    Company *
                  </label>
                  <input
                    type="text"
                    name="company"
                    id="company"
                    required
                    placeholder="Enter your company name"
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    placeholder="Enter your email"
                    aria-label="Email address"
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-neutral-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    id="phoneNumber"
                    placeholder="(123) 456-7890"
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="block text-sm font-medium text-neutral-700">
                    Message
                  </label>
                  <textarea
                    name="message"
                    id="message"
                    rows={4}
                    placeholder="How can we help you?"
                    className="mt-2 block w-full rounded-lg bg-white border-neutral-300 text-neutral-900 placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  ></textarea>
                </div>
              </div>

              {!isDevelopment && (
                <div
                  ref={turnstileRef}
                  data-size="flexible"
                  className="mt-4 min-h-[70px] flex justify-center items-center"
                  aria-label="Security challenge"
                >
                  {!turnstileLoaded && <div className="text-sm text-neutral-500">Loading security challenge...</div>}
                </div>
              )}

              {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

              <div className="space-y-6">
                <motion.button
                  type="submit"
                  className="w-full rounded-full bg-emerald-600 py-3 lg:py-4 px-6 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit"}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


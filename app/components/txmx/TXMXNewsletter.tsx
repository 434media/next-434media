"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
          className="relative w-full max-w-4xl bg-black border-2 border-white shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-black border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Close newsletter signup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col lg:flex-row min-h-[600px]">
            {/* Left Side - Image */}
            <div className="lg:w-1/2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20 z-10" />
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/bam3.jpg"
                alt="TXMX Boxing Fighter"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Right Side - Newsletter Form */}
            <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center relative overflow-hidden group">
              {/* Background Animation */}
              <div className="absolute inset-0 bg-white transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />

              <div className="relative z-10">
                {/* Header with Logo */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-6"
                  >
                    <div className="flex justify-center">
                      {/* TXMX Logo - Using text fallback if SVG doesn't load */}
                      <div className="relative">
                        <Image
                          src="https://ampd-asset.s3.us-east-2.amazonaws.com/TXMXBack.svg"
                          alt="TXMX Boxing Logo"
                          width={160}
                          height={80}
                          className="filter brightness-0 invert group-hover:brightness-100 group-hover:invert transition-all duration-500"
                          priority
                          onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "block"
                          }}
                        />
                        {/* Text fallback */}
                        <div className="hidden text-4xl lg:text-5xl font-black text-white group-hover:text-black tracking-wider uppercase transition-colors duration-500">
                          TXMX BOXING
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6"
                  >
                    <h2 className="text-2xl lg:text-3xl font-black text-white group-hover:text-black tracking-wider uppercase transition-colors duration-500">
                      Made from Blood, Sweat, and Tears
                    </h2>
                  </motion.div>

                  {/* Value Proposition */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <p className="text-lg text-white group-hover:text-black leading-relaxed font-bold tracking-wide transition-colors duration-500">
                      Get exclusive drops, insider access, and be first in the ring for limited releases.
                    </p>
                  </motion.div>
                </div>

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
                      className="space-y-6"
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
                          placeholder="ENTER YOUR EMAIL"
                          className="w-full px-6 py-4 border-2 border-white bg-transparent text-white placeholder-white/70 focus:outline-none focus:border-white transition-all duration-500 text-lg font-bold tracking-wider uppercase group-hover:border-black group-hover:text-black group-hover:placeholder-black/70"
                          aria-describedby={error ? "newsletter-error" : undefined}
                          disabled={isSubmitting}
                          autoComplete="email"
                        />
                      </div>

                      <div className="relative overflow-hidden group/button">
                        <div className="absolute inset-0 bg-white transform -translate-x-full group-hover/button:translate-x-0 transition-transform duration-500 ease-out" />
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="relative w-full bg-transparent border-2 border-white text-white py-4 px-8 font-black text-xl tracking-wider uppercase transition-colors duration-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black active:scale-[0.98] transform group-hover:border-black group-hover:text-black group-hover/button:border-black group-hover/button:text-black"
                          aria-label="Join TXMX newsletter"
                        >
                          <motion.div
                            animate={isSubmitting ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                            transition={isSubmitting ? { duration: 1.5, repeat: Number.POSITIVE_INFINITY } : {}}
                            className="flex items-center justify-center"
                          >
                            {isSubmitting ? "JOINING THE FIGHT..." : "JOIN THE FIGHT"}
                          </motion.div>
                        </button>
                      </div>

                      {!isDevelopment && (
                        <div
                          ref={turnstileRef}
                          data-theme="dark"
                          data-size="flexible"
                          className="w-full flex justify-center mt-6"
                          aria-label="Security verification"
                        />
                      )}

                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          id="newsletter-error"
                          className="text-red-400 text-sm text-center font-bold bg-red-900/20 border border-red-400 p-3 tracking-wide uppercase"
                          role="alert"
                        >
                          {error}
                        </motion.div>
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
                      <div className="mb-6">
                        <div className="w-20 h-20 bg-transparent border-2 border-white flex items-center justify-center mx-auto mb-6 group-hover:bg-white group-hover:border-black transition-all duration-500">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring", damping: 15 }}
                          >
                            <CheckIcon className="h-10 w-10 text-white group-hover:text-black transition-colors duration-500" />
                          </motion.div>
                        </div>
                        <h3 className="text-2xl lg:text-3xl font-black text-white group-hover:text-black mb-4 tracking-wider uppercase transition-colors duration-500">
                          SOMOS BOXEO
                        </h3>
                        <p className="text-white group-hover:text-black text-lg leading-relaxed font-bold tracking-wide transition-colors duration-500">
                          Exclusive drops and insider access.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
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

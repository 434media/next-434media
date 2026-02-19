"use client"

import type React from "react"
import { useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X } from "lucide-react"
import Image from "next/image"

interface NewsletterPopupProps {
  showModal: boolean
  onClose: () => void
}

export default function NewsletterPopup({ showModal, onClose }: NewsletterPopupProps) {
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
      setError("Enter your email to stay connected")
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

        // Reset success state and close modal after 3 seconds
        setTimeout(() => {
          setIsSuccess(false)
          onClose()
        }, 3000)
      } else {
        throw new Error(responseData.error || "Failed to subscribe to newsletter")
      }
    } catch (error) {
      console.error("Error subscribing to newsletter:", error)
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
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
            className="absolute top-3 md:top-4 right-4 z-20 p-2 bg-black border md:border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded-lg"
            aria-label="Close newsletter signup"
          >
            <X className="h-2 w-2" />
          </button>

          <div className="flex flex-col lg:flex-row min-h-[500px] md:min-h-[600px]">
            {/* Left Side - Image */}
            <div className="lg:w-1/2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30 z-10" />
              <Image
                src="https://ampd-asset.s3.us-east-2.amazonaws.com/soi.jpeg"
                alt="434 Media Creative Team"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Right Side - Newsletter Form */}
            <div className="lg:w-1/2 p-6 md:p-8 lg:p-12 flex flex-col justify-center relative overflow-hidden">
              {/* Header with Logo */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6"
                >
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="text-4xl font-black text-white tracking-wider uppercase transition-colors duration-500 font-menda-black">
                        434 MEDIA
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
                  <h2 className="text-2xl font-black text-white tracking-wider uppercase transition-colors duration-500">
                    JOIN OUR MONTHLY NEWSLETTER
                  </h2>
                </motion.div>

                {/* Value Proposition */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                  <p className="text-lg text-white leading-relaxed font-semibold tracking-wide transition-colors duration-500">
                    Explore how we blend creativity with community impact through innovative storytelling and design.
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
                    aria-label="434 Media Newsletter subscription form"
                  >
                    <div className="relative">
                      <label htmlFor="newsletter-email" className="sr-only">
                        Email address
                      </label>
                      <input
                        id="newsletter-email"
                        ref={inputRef}
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ENTER YOUR EMAIL"
                        className="w-full px-6 py-4 border-2 border-white bg-transparent text-white placeholder-white/70 focus:outline-none focus:border-white transition-all duration-500 text-lg font-bold tracking-wider uppercase rounded-lg"
                        aria-describedby={error ? "newsletter-error" : undefined}
                        disabled={isSubmitting}
                        autoComplete="email"
                      />
                    </div>

                    <div className="relative overflow-hidden">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="relative w-full bg-transparent border-2 border-white text-white py-4 px-8 font-black text-xl tracking-wider uppercase transition-colors duration-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black active:scale-[0.98] transform rounded-lg"
                        aria-label="Subscribe to 434 Media newsletter"
                      >
                        <motion.div
                          animate={isSubmitting ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                          transition={isSubmitting ? { duration: 1.5, repeat: Number.POSITIVE_INFINITY } : {}}
                          className="flex items-center justify-center"
                        >
                          {isSubmitting ? "CONNECTING..." : "STAY CONNECTED"}
                        </motion.div>
                      </button>
                    </div>

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
                      <div className="w-20 h-20 bg-transparent border-2 border-white flex items-center justify-center mx-auto mb-6 transition-all duration-500 rounded-lg">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", damping: 15 }}
                        >
                          <CheckIcon className="h-10 w-10 text-white transition-colors duration-500" />
                        </motion.div>
                      </div>
                      <h3 className="text-2xl lg:text-3xl font-black text-white mb-4 tracking-wider uppercase transition-colors duration-500">
                        Subscription Confirmed!
                      </h3>
                      <p className="text-white text-lg leading-relaxed font-semibold tracking-wide transition-colors duration-500">
                        Our next issue will be in your inbox soon.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

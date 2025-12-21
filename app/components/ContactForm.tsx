"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"

interface ContactFormProps {
  className?: string
  isVisible?: boolean
}

// This interface is used for the form data structure
interface FormValues {
  firstName: string
  lastName: string
  company: string
  email: string
  phoneNumber: string
  message: string
}

export function ContactForm({ className = "", isVisible = true }: ContactFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const firstNameRef = useRef<HTMLInputElement>(null)

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

  // Focus first input when form becomes visible
  useEffect(() => {
    if (isVisible && firstNameRef.current && !hasSubmitted) {
      // Small delay to ensure the form is visible
      const timeoutId = setTimeout(() => {
        firstNameRef.current?.focus({ preventScroll: true })
      }, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [isVisible, hasSubmitted])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setFieldErrors({})

    // Get form data
    const formData = new FormData(e.target as HTMLFormElement)
    const formValues: FormValues = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      company: formData.get("company") as string,
      email: formData.get("email") as string,
      phoneNumber: (formData.get("phoneNumber") as string) || "",
      message: (formData.get("message") as string) || "",
    }

    // Validate form data
    const errors: Record<string, string> = {}

    if (!formValues.firstName.trim()) {
      errors.firstName = "First name is required"
    }

    if (!formValues.lastName.trim()) {
      errors.lastName = "Last name is required"
    }

    if (!formValues.company.trim()) {
      errors.company = "Company is required"
    }

    if (!formValues.email.trim()) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formValues.email)) {
      errors.email = "Please enter a valid email address"
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      setIsLoading(false)
      return
    }

    try {
      // Log the request for debugging
      console.log("Submitting form with data:", formValues)

      const response = await fetch("/api/contact-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error("API error:", responseData)
        throw new Error(responseData.error || `Form submission failed with status: ${response.status}`)
      }

      setHasSubmitted(true)
      if (formRef.current) formRef.current.reset()

      // Reset success message after 5 seconds
      setTimeout(() => {
        setHasSubmitted(false)
      }, 5000)
    } catch (error) {
      console.error("Error submitting form:", error)
      setError(
        `${error instanceof Error ? error.message : "An error occurred while submitting the contact form"}. Please try again.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`bg-black/40 backdrop-blur-sm rounded-2xl lg:rounded-3xl p-6 lg:p-8 overflow-hidden border border-emerald-500/30 ${className}`}
    >
      <AnimatePresence mode="wait">
        {hasSubmitted ? (
          <motion.div
            key="success"
            variants={successVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="py-8 flex items-center justify-center h-full"
            aria-live="polite"
            role="status"
          >
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-emerald-400 flex items-center justify-center rounded-full bg-emerald-500/20">
                <i className="ri-check-line text-2xl" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">Thanks for Connecting!</h3>
              <p className="mt-2 text-sm text-neutral-300">We&apos;ll be in touch soon.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            variants={formVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-live="polite"
          >
            <p className="text-sm text-neutral-400 mb-6 lg:mb-8">
              All fields marked with an asterisk (*) are required.
            </p>
            <form className="space-y-6" onSubmit={handleSubmit} ref={formRef} id="contact-form" noValidate>
              <div className="grid grid-cols-1 gap-x-4 lg:gap-x-8 gap-y-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-neutral-300">
                    First Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    ref={firstNameRef}
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.firstName}
                    aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                    className={`mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border ${
                      fieldErrors.firstName
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-600 focus:ring-emerald-500 focus:border-emerald-500"
                    } text-white placeholder-neutral-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3`}
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-sm text-red-600" id="firstName-error">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-neutral-300">
                    Last Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.lastName}
                    aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                    className={`mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border ${
                      fieldErrors.lastName
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-600 focus:ring-emerald-500 focus:border-emerald-500"
                    } text-white placeholder-neutral-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3`}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1 text-sm text-red-600" id="lastName-error">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="company" className="block text-sm font-medium text-neutral-300">
                    Company <span aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    name="company"
                    id="company"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.company}
                    aria-describedby={fieldErrors.company ? "company-error" : undefined}
                    placeholder="Enter your company name"
                    className={`mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border ${
                      fieldErrors.company
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-600 focus:ring-emerald-500 focus:border-emerald-500"
                    } text-white placeholder-neutral-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3`}
                  />
                  {fieldErrors.company && (
                    <p className="mt-1 text-sm text-red-600" id="company-error">
                      {fieldErrors.company}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-300">
                    Work Email <span aria-hidden="true">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    placeholder="Enter your email"
                    className={`mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border ${
                      fieldErrors.email
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-600 focus:ring-emerald-500 focus:border-emerald-500"
                    } text-white placeholder-neutral-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600" id="email-error">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-neutral-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    id="phoneNumber"
                    placeholder="(123) 456-7890"
                    className="mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border border-neutral-600 text-white placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="block text-sm font-medium text-neutral-300">
                    Message
                  </label>
                  <textarea
                    name="message"
                    id="message"
                    rows={4}
                    placeholder="How can we help you?"
                    className="mt-2 block w-full rounded-lg bg-neutral-900/50 backdrop-blur-sm border border-neutral-600 text-white placeholder-neutral-500 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm px-3 py-2.5 lg:px-4 lg:py-3"
                  ></textarea>
                </div>
              </div>

              {error && (
                <div
                  className="p-3 bg-red-900/50 border border-red-500/50 rounded-md text-red-300 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <motion.button
                  type="submit"
                  className="w-full rounded-full bg-emerald-600 py-3 lg:py-4 px-6 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit"
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

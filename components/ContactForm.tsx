"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Eyebrow } from "@/components/ui/Eyebrow"

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
      className={`bg-white rounded-2xl lg:rounded-3xl p-5 lg:p-6 overflow-hidden border border-neutral-200 shadow-sm ${className}`}
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
              <div className="mx-auto h-12 w-12 text-neutral-900 flex items-center justify-center rounded-full bg-neutral-100">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900 tracking-tight leading-tight">Thanks for Connecting!</h3>
              <p className="mt-1.5 text-sm text-neutral-500 font-normal leading-tight">We&apos;ll be in touch soon.</p>
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
            <div className="mb-4 lg:mb-5">
              {/* Geist, not the ggx88 display face. This is a card heading at
                  20px; the display face only carries its personality at page-
                  headline sizes (48px+) and below that just reads as an odd
                  sans. Display type is reserved for page-level headlines. */}
              <h2 className="font-geist-sans text-xl font-semibold text-neutral-900 tracking-tight leading-none">Get in Touch</h2>
              <p className="mt-1.5 text-xs text-neutral-400 font-normal leading-tight">Fields marked with * are required</p>
            </div>
            <form className="space-y-3.5" onSubmit={handleSubmit} ref={formRef} id="contact-form" noValidate>
              <div className="grid grid-cols-1 gap-x-4 lg:gap-x-5 gap-y-3.5 sm:grid-cols-2">
                <div>
                  <Eyebrow as="label" htmlFor="firstName" className="block">
                    First Name <span aria-hidden="true">*</span>
                  </Eyebrow>
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    ref={firstNameRef}
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.firstName}
                    aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                    className={`mt-1.5 block w-full rounded-lg bg-neutral-50 border ${
                      fieldErrors.firstName
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-200 focus:ring-neutral-900 focus:border-neutral-900"
                    } text-neutral-900 placeholder-neutral-400 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors`}
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-sm text-red-600" id="firstName-error">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <Eyebrow as="label" htmlFor="lastName" className="block">
                    Last Name <span aria-hidden="true">*</span>
                  </Eyebrow>
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.lastName}
                    aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                    className={`mt-1.5 block w-full rounded-lg bg-neutral-50 border ${
                      fieldErrors.lastName
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-200 focus:ring-neutral-900 focus:border-neutral-900"
                    } text-neutral-900 placeholder-neutral-400 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors`}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1 text-sm text-red-600" id="lastName-error">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Eyebrow as="label" htmlFor="company" className="block">
                    Company <span aria-hidden="true">*</span>
                  </Eyebrow>
                  <input
                    type="text"
                    name="company"
                    id="company"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.company}
                    aria-describedby={fieldErrors.company ? "company-error" : undefined}
                    placeholder="Enter your company name"
                    className={`mt-1.5 block w-full rounded-lg bg-neutral-50 border ${
                      fieldErrors.company
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-200 focus:ring-neutral-900 focus:border-neutral-900"
                    } text-neutral-900 placeholder-neutral-400 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors`}
                  />
                  {fieldErrors.company && (
                    <p className="mt-1 text-sm text-red-600" id="company-error">
                      {fieldErrors.company}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Eyebrow as="label" htmlFor="email" className="block">
                    Work Email <span aria-hidden="true">*</span>
                  </Eyebrow>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    aria-required="true"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    placeholder="Enter your email"
                    className={`mt-1.5 block w-full rounded-lg bg-neutral-50 border ${
                      fieldErrors.email
                        ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                        : "border-neutral-200 focus:ring-neutral-900 focus:border-neutral-900"
                    } text-neutral-900 placeholder-neutral-400 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600" id="email-error">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Eyebrow as="label" htmlFor="phoneNumber" className="block">
                    Phone Number
                  </Eyebrow>
                  <input
                    type="tel"
                    name="phoneNumber"
                    id="phoneNumber"
                    placeholder="(123) 456-7890"
                    className="mt-1.5 block w-full rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:ring-neutral-900 focus:border-neutral-900 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Eyebrow as="label" htmlFor="message" className="block">
                    Message
                  </Eyebrow>
                  <textarea
                    name="message"
                    id="message"
                    rows={2}
                    placeholder="How can we help you?"
                    className="mt-1.5 block w-full rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:ring-neutral-900 focus:border-neutral-900 text-sm px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors"
                  ></textarea>
                </div>
              </div>

              {error && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="pt-1">
                <Button type="submit" size="lg" fullWidth disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />
                      Submitting…
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

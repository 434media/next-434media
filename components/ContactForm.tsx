"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { BUDGET_RANGES, ORGANIZATION_TYPES, REQUEST_OPTIONS } from "@/lib/start-a-production"

interface ContactFormProps {
  className?: string
  isVisible?: boolean
}

// The "Start a production" intake (master 9.5). Every field 9.5 lists is
// required; phone is the one optional contact detail.
const REQUIRED: Array<[name: string, message: string]> = [
  ["firstName", "First name is required"],
  ["lastName", "Last name is required"],
  ["role", "Role is required"],
  ["company", "Organization is required"],
  ["organizationType", "Choose an organization type"],
  ["email", "Email is required"],
  ["requestType", "Choose a request"],
  ["message", "Tell us what you want to produce or accomplish"],
  ["timeline", "Timeline is required"],
  ["budgetRange", "Choose a budget range"],
  ["referralSource", "Tell us how you heard about 434"],
]

type ControlProps = {
  name: string
  id: string
  "aria-invalid": boolean
  "aria-describedby"?: string
  className: string
}

const fieldClass = (hasError: boolean) =>
  `mt-1.5 block w-full rounded-lg bg-neutral-50 border ${
    hasError
      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
      : "border-neutral-200 focus:ring-neutral-900 focus:border-neutral-900"
  } text-neutral-900 placeholder-neutral-400 t-control px-3 py-2 lg:px-3.5 lg:py-2.5 transition-colors`

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

    const formData = new FormData(e.target as HTMLFormElement)
    const values: Record<string, string> = {}
    for (const name of [...REQUIRED.map(([n]) => n), "phoneNumber"]) {
      values[name] = ((formData.get(name) as string) || "").trim()
    }

    const errors: Record<string, string> = {}
    for (const [name, message] of REQUIRED) {
      if (!values[name]) errors[name] = message
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      errors.email = "Please enter a valid email address"
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/contact-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
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
        `${error instanceof Error ? error.message : "An error occurred while submitting the form"}. Please try again.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Label, control and error message for one field. `span` widens it to both
  // columns on the two-column layout.
  const field = (
    name: string,
    label: string,
    control: (props: ControlProps) => React.ReactNode,
    { required = true, span = true }: { required?: boolean; span?: boolean } = {},
  ) => (
    <div className={span ? "sm:col-span-2" : undefined}>
      <Eyebrow as="label" htmlFor={name} className="block">
        {label} {required && <span aria-hidden="true">*</span>}
      </Eyebrow>
      {control({
        name,
        id: name,
        "aria-invalid": !!fieldErrors[name],
        "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
        className: fieldClass(!!fieldErrors[name]),
      })}
      {fieldErrors[name] && (
        <p className="mt-1 t-body-s text-red-600" id={`${name}-error`}>
          {fieldErrors[name]}
        </p>
      )}
    </div>
  )

  const select = (options: readonly string[]) =>
    function SelectControl(props: ControlProps) {
      return (
        <select {...props} required aria-required="true" defaultValue="">
          <option value="" disabled>
            Select one
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
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
              <h3 className="mt-4 t-heading-s text-neutral-900 tracking-tight">Thank you. We have your request.</h3>
              <p className="mt-1.5 t-body-s text-neutral-500">
                We review every request before confirming the right next step.
              </p>
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
              <h2 className="font-geist-sans t-heading-s text-neutral-900 tracking-tight">Production details</h2>
              <p className="mt-1.5 t-caption text-neutral-400">Fields marked with * are required</p>
            </div>
            <form className="space-y-3.5" onSubmit={handleSubmit} ref={formRef} id="contact-form" noValidate>
              <div className="grid grid-cols-1 gap-x-4 lg:gap-x-5 gap-y-3.5 sm:grid-cols-2">
                {field("firstName", "First name", (p) => <input type="text" ref={firstNameRef} required aria-required="true" {...p} />, { span: false })}
                {field("lastName", "Last name", (p) => <input type="text" required aria-required="true" {...p} />, { span: false })}
                {field("role", "Role", (p) => <input type="text" required aria-required="true" placeholder="Your title or role" {...p} />, { span: false })}
                {field("company", "Organization", (p) => <input type="text" required aria-required="true" placeholder="Organization name" {...p} />, { span: false })}
                {field("organizationType", "Organization type", select(ORGANIZATION_TYPES))}
                {field("email", "Work email", (p) => <input type="email" required aria-required="true" placeholder="name@organization.com" {...p} />, { span: false })}
                {field("phoneNumber", "Phone", (p) => <input type="tel" placeholder="(123) 456-7890" {...p} />, { required: false, span: false })}
                {field("requestType", "Request", select(REQUEST_OPTIONS))}
                {field("message", "What do you want to produce or accomplish?", (p) => <textarea rows={3} required aria-required="true" {...p} />)}
                {field("timeline", "Timeline", (p) => <input type="text" required aria-required="true" placeholder="Target date or window" {...p} />, { span: false })}
                {field("budgetRange", "Budget range", select(BUDGET_RANGES), { span: false })}
                {field("referralSource", "How did you hear about 434?", (p) => <input type="text" required aria-required="true" {...p} />)}
              </div>

              {error && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 t-body-s"
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
                      Sending…
                    </>
                  ) : (
                    "Start a production"
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

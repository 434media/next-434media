"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Check, Loader2 } from "lucide-react"
import { Select } from "@/components/ui/Select"
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

// The form treatment in Display and Design Standard 3.7, as the Lead with Ops
// feedback form has it: square-cornered white fields, a neutral border that
// darkens to the palette black on focus, and the one functional error colour
// (the palette's signal) in place of Tailwind's reds.
const fieldClass = (hasError: boolean) =>
  `mt-1.5 block w-full bg-(--434-white) border ${
    hasError
      ? "border-(--color-fn-error)"
      : "border-neutral-300 hover:border-neutral-500 focus:border-(--434-color-02-black)"
  } text-neutral-900 placeholder:text-neutral-500 t-control px-3.5 py-2.5 transition-colors focus:outline-none`

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
      <label htmlFor={name} className="t-label block text-neutral-600">
        {label}{" "}
        {required && (
          <span className="text-(--color-fn-error)" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control({
        name,
        id: name,
        "aria-invalid": !!fieldErrors[name],
        "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
        className: fieldClass(!!fieldErrors[name]),
      })}
      {fieldErrors[name] && (
        <p className="mt-1 t-body-s text-(--color-fn-error)" id={`${name}-error`}>
          {fieldErrors[name]}
        </p>
      )}
    </div>
  )

  // The branded dropdown (components/ui/Select.tsx), not a native <select>.
  const select = (options: readonly string[]) =>
    function SelectControl(props: ControlProps) {
      return (
        <Select
          name={props.name}
          id={props.id}
          options={options}
          invalid={props["aria-invalid"]}
          describedBy={props["aria-describedby"]}
        />
      )
    }

  // One numbered section, in the shape of the Work page's service header
  // (.serviceHeader): the label on the left in heading-l, the fields in the
  // right column on the same 1.2 : 1 split from 1000px, a hairline above. The
  // padding is Work's: 24px, 28px / 24px from 680px, 32px / 40px from 1000px.
  const section = (id: string, title: string, children: React.ReactNode) => (
    <div
      role="group"
      aria-labelledby={id}
      className="grid gap-4 border-t border-neutral-200 p-6 type:px-6 type:py-7 min-[1000px]:grid-cols-[1.2fr_1fr] min-[1000px]:gap-10 min-[1000px]:px-10 min-[1000px]:py-8"
    >
      <h2 id={id} className="t-heading-l m-0">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </div>
  )

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {hasSubmitted ? (
          <motion.div
            key="success"
            variants={successVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid gap-4 border-t border-neutral-200 p-6 type:px-6 type:py-7 min-[1000px]:grid-cols-[1.2fr_1fr] min-[1000px]:gap-10 min-[1000px]:px-10 min-[1000px]:py-8"
            aria-live="polite"
            role="status"
          >
            <h2 className="t-heading-l m-0 flex items-center gap-3">
              <Check className="h-7 w-7 shrink-0" aria-hidden="true" />
              Received
            </h2>
            <div>
              <p className="t-heading-s m-0">Thank you. We have your request.</p>
              <p className="mt-1.5 t-body text-neutral-600">
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
            <form onSubmit={handleSubmit} ref={formRef} id="contact-form" noValidate>
              {section(
                "contact-you",
                "01 / You",
                <>
                  {field("firstName", "First name", (p) => <input type="text" ref={firstNameRef} required aria-required="true" autoComplete="given-name" {...p} />, { span: false })}
                  {field("lastName", "Last name", (p) => <input type="text" required aria-required="true" autoComplete="family-name" {...p} />, { span: false })}
                  {field("role", "Role", (p) => <input type="text" required aria-required="true" autoComplete="organization-title" placeholder="Your title or role" {...p} />, { span: false })}
                  {field("company", "Organization", (p) => <input type="text" required aria-required="true" autoComplete="organization" placeholder="Organization name" {...p} />, { span: false })}
                  {field("email", "Work email", (p) => <input type="email" required aria-required="true" autoComplete="email" placeholder="name@organization.com" {...p} />, { span: false })}
                  {field("phoneNumber", "Phone", (p) => <input type="tel" autoComplete="tel" placeholder="(123) 456-7890" {...p} />, { required: false, span: false })}
                </>,
              )}
              {section(
                "contact-production",
                "02 / The production",
                <>
                  {field("organizationType", "Organization type", select(ORGANIZATION_TYPES), { span: false })}
                  {field("requestType", "Request", select(REQUEST_OPTIONS), { span: false })}
                  {field("message", "What do you want to produce or accomplish?", (p) => <textarea rows={3} required aria-required="true" {...p} className={`${p.className} resize-y`} />)}
                </>,
              )}
              {section(
                "contact-timing",
                "03 / Timing and budget",
                <>
                  {field("timeline", "Timeline", (p) => <input type="text" required aria-required="true" placeholder="Target date or window" {...p} />, { span: false })}
                  {field("budgetRange", "Budget range", select(BUDGET_RANGES), { span: false })}
                  {field("referralSource", "How did you hear about 434?", (p) => <input type="text" required aria-required="true" {...p} />)}

                  {error && (
                    <p className="sm:col-span-2 t-body-s text-(--color-fn-error)" role="alert">
                      {error}
                    </p>
                  )}

                  {/* 3.7's submit: full width, square, white on the palette black. */}
                  <div className="sm:col-span-2 pt-2">
                    <p className="mb-2 t-caption text-neutral-500">
                      <span className="text-(--color-fn-error)" aria-hidden="true">*</span> Required
                    </p>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="t-control-emphasis flex w-full items-center justify-center gap-2 bg-(--434-color-02-black) px-6 py-3.5 text-(--434-white) transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--434-color-02-black) focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />
                          Sending…
                        </>
                      ) : (
                        "Start a production"
                      )}
                    </button>
                  </div>
                </>,
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

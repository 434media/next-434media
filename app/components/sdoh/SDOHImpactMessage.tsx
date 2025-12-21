"use client"

import type React from "react"
import { useState, useRef } from "react"
import Image from "next/image"
import { FadeIn } from "../FadeIn"
import { useMobile } from "../../hooks/use-mobile"
import type { Locale } from "../../../i18n-config"
import type { Dictionary } from "@/app/types/dictionary"

interface NewsletterDictionary {
  placeholder: string
  buttonText: string
  successMessage: string
  errorMessage: string
  [key: string]: string
}

const defaultNewsletterText: NewsletterDictionary = {
  placeholder: "Enter your email",
  buttonText: "Subscribe",
  successMessage: "Thanks for subscribing to the SDOH newsletter! We'll be in touch soon.",
  errorMessage: "Please enter a valid email address",
}

interface SDOHImpactMessageProps {
  locale: Locale
  dict: Dictionary
}

export default function SDOHImpactMessage({ locale, dict }: SDOHImpactMessageProps) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMobile()

  const impactDict = dict?.sdoh?.impact || {
    question: "What can I do to make a difference?",
    message: "If you've ever asked, ",
    conclusion: " — this is where you start.",
  }

  const newsletterDict =
    dict?.newsletter && typeof dict.newsletter === "object"
      ? (dict.newsletter as unknown as NewsletterDictionary)
      : defaultNewsletterText

  const joinText = locale === "es" ? "Únete a la conversación" : "Join the Conversation"

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0.9.-]+\.[a-zA-Z]{2,}$/

  const validateEmail = (email: string): boolean => {
    return emailPattern.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError(newsletterDict.errorMessage || "Please enter your email address")
      inputRef.current?.focus()
      return
    }

    if (!validateEmail(email)) {
      setError(newsletterDict.errorMessage || "Please enter a valid email address")
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/sdoh-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      formRef.current?.reset()

      setTimeout(() => setIsSuccess(false), 5000)
    } catch (error) {
      console.error("Error subscribing to newsletter:", error)
      setError(`${error instanceof Error ? error.message : "An unexpected error occurred"}. Please try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="py-20 sm:py-28 lg:py-32 overflow-hidden relative bg-neutral-900" id="newsletter">
      {/* Accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
        <FadeIn>
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left side - SDOH Logo */}
            <div className="relative order-2 md:order-1">
              <div className="relative w-full max-w-md mx-auto">
                <Image
                  src="https://ampd-asset.s3.us-east-2.amazonaws.com/que.svg"
                  alt="SDOH Logo"
                  width={400}
                  height={400}
                  className="w-full h-auto"
                />
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-yellow-400" />
              </div>
            </div>

            {/* Right side - Impact Message + Newsletter */}
            <div className="order-1 md:order-2">
              {/* Impact Message as Header */}
              <div className="mb-8">
                <blockquote className="relative">
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                    <span className="text-white">{impactDict.message}</span>
                    <span className="text-cyan-400 italic">&quot;{impactDict.question}&quot;</span>
                    <span className="text-white">{impactDict.conclusion}</span>
                  </p>
                </blockquote>
              </div>

              {/* Join the Conversation */}
              <p className="text-lg text-white/80 mb-6">{joinText}</p>

              {/* Newsletter Form */}
              <div className="w-full">
                {!isSuccess ? (
                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="newsletter-form"
                    aria-label="SDOH Newsletter subscription form"
                  >
                    <div className="relative flex flex-col sm:flex-row items-center overflow-hidden bg-white/10 border border-white/20">
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
                        placeholder={newsletterDict.placeholder || "Enter your email"}
                        className="w-full px-4 py-3 sm:py-4 bg-transparent focus:outline-none text-white text-sm sm:text-base placeholder-white/70"
                        aria-describedby={error ? "newsletter-error" : undefined}
                        disabled={isSubmitting}
                        autoComplete="email"
                      />
                      <div className={`${isMobile ? "w-full mt-2 px-4 pb-4" : "absolute right-2"}`}>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className={`${isMobile ? "w-full" : "w-auto px-4 h-10"} bg-white text-neutral-900 flex items-center justify-center hover:bg-neutral-100 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-900 py-2 px-4 font-medium`}
                          aria-label="Subscribe to SDOH newsletter"
                        >
                          {isSubmitting ? (
                            <LoadingIcon className="h-5 w-5" />
                          ) : (
                            <span className="flex items-center">
                              {newsletterDict.buttonText || "Subscribe"} <ArrowIcon className="h-5 w-5 ml-2" />
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div id="newsletter-error" className="text-white/90 text-sm mt-2 px-2" role="alert">
                        {error}
                      </div>
                    )}
                  </form>
                ) : (
                  <div
                    className="bg-white/10 border border-white/20 px-4 sm:px-6 py-4 flex items-center"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="bg-cyan-500 p-1 mr-3 flex-shrink-0">
                      <CheckIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <span className="text-white text-sm sm:text-base font-medium">
                      {newsletterDict.successMessage || "Thanks for subscribing to the SDOH newsletter! We'll be in touch soon."}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
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

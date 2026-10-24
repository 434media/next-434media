"use client"

import { useState, type FormEvent } from "react"
import {
  SESSION_VALUE_MIN,
  SESSION_VALUE_MAX,
  SESSION_VALUE_LOW_LABEL,
  SESSION_VALUE_HIGH_LABEL,
  TALK_FURTHER_OPTIONS,
  ROLE_OPTIONS,
  INDUSTRY_OPTIONS,
  HEARD_ABOUT_OPTIONS,
  OTHER_OPTION,
} from "@/lib/lead-with-ops-feedback"

// The post-event feedback form, moved from the Digital Canvas site (founder,
// 2026-10-24). Questions, options, required fields and client-side guards are
// unchanged; the server route repeats every check. Styled in 434 palette tokens
// and type roles. Selection is shown with the palette's color-03, and the error
// state with the functional signal colour.

const SESSION_SCALE = Array.from(
  { length: SESSION_VALUE_MAX - SESSION_VALUE_MIN + 1 },
  (_, i) => SESSION_VALUE_MIN + i,
)

type FormStatus = "idle" | "submitting" | "success" | "error"

const Required = () => <span className="text-[var(--color-fn-error)]">*</span>

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="t-label text-neutral-600 mb-2 block">
      {children} <Required />
    </label>
  )
}

const inputClass =
  "t-control w-full bg-[var(--434-white)] border border-neutral-300 text-neutral-900 px-3.5 py-3 focus:outline-none focus:border-[var(--434-color-02-black)] transition-colors placeholder:text-neutral-500"

const SELECTED = "border-[var(--434-color-03)] bg-[var(--434-color-04)] text-neutral-900"
const UNSELECTED = "border-neutral-300 bg-[var(--434-white)] text-neutral-800 hover:border-neutral-500"

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-px bg-neutral-200" />
      <p className="t-label text-neutral-900">{children}</p>
    </>
  )
}

function ChoiceGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly string[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <fieldset>
      <legend className="t-label text-neutral-600 mb-2 block">
        {legend} <Required />
      </legend>
      <div className="space-y-2" role="radiogroup" aria-label={legend}>
        {options.map((opt) => {
          const isSelected = value === opt
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt)}
              className={`t-control w-full text-left px-3.5 py-3 border transition-colors ${isSelected ? `${SELECTED} font-semibold` : UNSELECTED}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function LeadWithOpsFeedbackPage() {
  const [status, setStatus] = useState<FormStatus>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [thanksName, setThanksName] = useState("")

  const [sessionValue, setSessionValue] = useState<number | null>(null)
  const [talkFurther, setTalkFurther] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [industry, setIndustry] = useState<string | null>(null)
  const [heardAbout, setHeardAbout] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("submitting")
    setErrorMsg("")

    const form = e.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get("email") || "").trim()
    const name = String(formData.get("name") || "").trim()
    const company = String(formData.get("company") || "").trim()
    const mostUseful = String(formData.get("mostUseful") || "").trim()
    const biggestQuestion = String(formData.get("biggestQuestion") || "").trim()
    const industryOther = String(formData.get("industryOther") || "").trim()

    // Client-side guards for the styled (non-native) single-choice questions.
    if (sessionValue === null) return fail("Please rate how valuable today's session was.")
    if (talkFurther === null) return fail("Please tell us if you'd like to talk further.")
    if (role === null) return fail("Please select your role.")
    if (industry === null) return fail("Please select your industry.")
    if (industry === OTHER_OPTION && industryOther.length === 0) return fail("Please specify your industry.")
    if (heardAbout === null) return fail("Please tell us how you heard about the session.")

    // Abort the request if it stalls, so the button can never get stuck on
    // "Sending..." indefinitely — surface a retryable error instead.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch("/api/lead-with-ops/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email,
          name,
          company,
          sessionValue,
          mostUseful,
          talkFurther,
          role,
          industry,
          industryOther,
          biggestQuestion,
          heardAbout,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Submission failed. Please try again.")
      }

      const body = await res.json()
      setThanksName(body?.data?.name || name)
      setStatus("success")
      form.reset()
    } catch (err) {
      setStatus("error")
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMsg("That took too long to send. Please check your connection and try again.")
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
      }
    } finally {
      clearTimeout(timeout)
    }

    function fail(message: string) {
      setStatus("error")
      setErrorMsg(message)
    }
  }

  return (
    <main className="bg-[var(--434-background)] text-[var(--434-text)] min-h-screen">
      <section className="pt-28 md:pt-32 pb-20 md:pb-28 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <p className="t-label text-neutral-500 mb-6">Lunch &amp; Learn feedback</p>
          <h1 className="font-ggx88 t-display-m text-neutral-900 mb-5">
            Lead with Ops. <span className="block text-neutral-500">Layer in AI.</span>
          </h1>
          <p className="t-body-l text-neutral-700 mb-10">
            Thank you for spending your lunch with us. Ninety seconds of feedback shapes the next session — and tells
            us who&apos;d like to keep the conversation going.
          </p>

          {status === "success" ? (
            <div className="border border-neutral-200 p-7 md:p-9" role="status">
              <p className="t-label text-neutral-500 mb-4">Received</p>
              <h2 className="t-heading-l text-neutral-900 mb-4">
                Thank you{thanksName ? `, ${thanksName}.` : "."}
              </h2>
              <p className="t-body text-neutral-700">
                Your feedback is in. If you asked to keep the conversation going, we&apos;ll be in touch. Questions in
                the meantime?{" "}
                <a href="mailto:VIP@434MEDIA.COM" className="text-neutral-900 font-semibold hover:underline">
                  VIP@434MEDIA.COM
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="border border-neutral-200 p-6 md:p-8 space-y-7">
              {/* Q1 — Email */}
              <div>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@company.com" />
              </div>

              <SectionLabel>Today&apos;s session</SectionLabel>

              {/* Q2 — Session value 1–5 */}
              <fieldset>
                <legend className="t-label text-neutral-600 mb-2 block">
                  How valuable was today&apos;s session? <Required />
                </legend>
                <div className="grid grid-cols-5 gap-1.5">
                  {SESSION_SCALE.map((n) => {
                    const isSelected = sessionValue === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSessionValue(n)}
                        className={`t-heading-m border p-3 transition-colors ${isSelected ? SELECTED : UNSELECTED}`}
                        aria-pressed={isSelected}
                        aria-label={`${n}${n === SESSION_VALUE_MIN ? ` — ${SESSION_VALUE_LOW_LABEL}` : ""}${n === SESSION_VALUE_MAX ? ` — ${SESSION_VALUE_HIGH_LABEL}` : ""}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="t-caption text-neutral-500">{SESSION_VALUE_LOW_LABEL}</span>
                  <span className="t-caption text-neutral-500">{SESSION_VALUE_HIGH_LABEL}</span>
                </div>
              </fieldset>

              {/* Q3 — Most useful */}
              <div>
                <FieldLabel htmlFor="mostUseful">What was most useful — or what would&apos;ve made it better?</FieldLabel>
                <textarea id="mostUseful" name="mostUseful" required rows={4} className={`${inputClass} resize-y`} placeholder="A sentence or two is plenty." />
              </div>

              <SectionLabel>Keep the conversation going</SectionLabel>

              {/* Q4 — Talk further */}
              <ChoiceGroup
                legend="Would you like to talk further about AI in your operations?"
                options={TALK_FURTHER_OPTIONS}
                value={talkFurther}
                onChange={setTalkFurther}
              />

              <SectionLabel>A bit about you</SectionLabel>

              {/* Q5 / Q6 — Name + Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <input id="name" name="name" type="text" required autoComplete="name" className={inputClass} placeholder="Jane Operator" />
                </div>
                <div>
                  <FieldLabel htmlFor="company">Company</FieldLabel>
                  <input id="company" name="company" type="text" required autoComplete="organization" className={inputClass} placeholder="Acme Co." />
                </div>
              </div>

              {/* Q7 — Role */}
              <ChoiceGroup legend="Your role" options={ROLE_OPTIONS} value={role} onChange={setRole} />

              {/* Q8 — Industry (+ Other short answer) */}
              <div>
                <ChoiceGroup legend="Your industry" options={INDUSTRY_OPTIONS} value={industry} onChange={setIndustry} />
                {industry === OTHER_OPTION && (
                  <input
                    name="industryOther"
                    type="text"
                    className={`${inputClass} mt-2`}
                    placeholder="Tell us your industry"
                    aria-label="Specify your industry"
                  />
                )}
              </div>

              {/* Q9 — Biggest question / blocker */}
              <div>
                <FieldLabel htmlFor="biggestQuestion">What&apos;s your single biggest question or blocker with AI right now?</FieldLabel>
                <textarea id="biggestQuestion" name="biggestQuestion" required rows={3} className={`${inputClass} resize-y`} placeholder="The one thing you'd most like answered." />
              </div>

              <SectionLabel>Attribution</SectionLabel>

              {/* Q10 — Heard about */}
              <ChoiceGroup
                legend="How did you hear about today's session?"
                options={HEARD_ABOUT_OPTIONS}
                value={heardAbout}
                onChange={setHeardAbout}
              />

              {status === "error" && errorMsg && (
                <p className="t-body-s text-[var(--color-fn-error)]" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="t-control-emphasis w-full py-4 px-6 bg-[var(--434-color-02-black)] text-[var(--434-white)] hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? "Sending..." : "Send feedback"}
              </button>

              <p className="t-caption text-neutral-500">
                Presented by Digital Canvas · 434 MEDIA. Your responses are used to improve future sessions.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

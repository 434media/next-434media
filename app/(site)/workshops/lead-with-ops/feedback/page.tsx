"use client"

import { useState, type FormEvent } from "react"
import { motion } from "motion/react"
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

// Carroll Strategy & Operations color system — matches the event page.
const EMERALD = "#1AAD9B" // positive accent: selection, structural bullets
const CORAL = "#FF5757" // sparingly: CTA, required markers, errors

const SESSION_SCALE = Array.from(
  { length: SESSION_VALUE_MAX - SESSION_VALUE_MIN + 1 },
  (_, i) => SESSION_VALUE_MIN + i,
)

type FormStatus = "idle" | "submitting" | "success" | "error"

// Shared field-label styling (pixel font, uppercase, tracked) with a required mark.
function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.25em] text-[#6F7883] font-bold mb-2 block"
    >
      {children} <span style={{ color: CORAL }}>*</span>
    </label>
  )
}

const inputClass =
  "w-full bg-white border border-[#E1E4EA] text-[#041C32] text-sm px-3.5 py-3 focus:outline-none focus:border-[#041C32] transition-colors placeholder:text-[#6F7883]/60"

// One styled single-choice list (radio group) with emerald selection accent.
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
      <legend className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.25em] text-[#6F7883] font-bold mb-2 block">
        {legend} <span style={{ color: CORAL }}>*</span>
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
              className={`w-full text-left text-sm px-3.5 py-3 border-l-2 border transition-colors ${
                isSelected
                  ? "border-transparent text-[#041C32] font-medium"
                  : "border-[#E1E4EA] bg-white text-[#041C32]/80 hover:border-[#041C32]/40"
              }`}
              style={isSelected ? { backgroundColor: `${EMERALD}1A`, borderLeftColor: EMERALD } : undefined}
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

  // Single-choice selections held in state so the styled selection renders.
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
    <main className="bg-white min-h-screen text-[#041C32]">
      <section className="relative pt-28 md:pt-32 pb-20 md:pb-28 px-6">
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ backgroundImage: `linear-gradient(to right, transparent, ${CORAL}55, transparent)` }}
        />

        <div className="relative z-10 max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 flex-wrap mb-7"
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: EMERALD }} />
              <span className="font-(family-name:--font-geist-pixel-square) text-[10px] md:text-xs uppercase tracking-[0.4em] text-[#041C32] font-bold">
                Lunch &amp; Learn Feedback
              </span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-(family-name:--font-geist-pixel-square) text-3xl md:text-5xl text-[#041C32] uppercase tracking-wide leading-[1.1] font-black mb-5"
          >
            Lead with Ops.{" "}
            <span className="text-[#6F7883] font-medium block">Layer in AI.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="text-[#6F7883] text-base md:text-lg leading-relaxed mb-10"
          >
            Thank you for spending your lunch with us. Ninety seconds of feedback shapes the next
            session — and tells us who&apos;d like to keep the conversation going.
          </motion.p>

          {status === "success" ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="border border-[#E1E4EA] bg-white p-7 md:p-9 relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: EMERALD }} aria-hidden="true" />
              <span
                className="inline-block font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold mb-4 px-2.5 py-1 text-[#041C32]"
                style={{ backgroundColor: EMERALD }}
              >
                Received
              </span>
              <h2 className="font-(family-name:--font-geist-pixel-square) text-2xl md:text-3xl text-[#041C32] uppercase tracking-wide leading-tight mb-4">
                Thank you{thanksName ? "," : "."}{" "}
                {thanksName && <span className="text-[#6F7883] font-medium">{thanksName}.</span>}
              </h2>
              <p className="text-[#6F7883] text-sm md:text-base leading-relaxed">
                Your feedback is in. If you asked to keep the conversation going, we&apos;ll be in touch.
                Questions in the meantime?{" "}
                <a href="mailto:VIP@434MEDIA.COM" className="text-[#041C32] hover:underline font-semibold">
                  VIP@434MEDIA.COM
                </a>
                .
              </p>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24 }}
              onSubmit={handleSubmit}
              className="border border-[#E1E4EA] bg-white p-6 md:p-8 space-y-7"
            >
              {/* Q1 — Email */}
              <div>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} placeholder="you@company.com" />
              </div>

              {/* Section: Today's session */}
              <div className="h-px bg-[#E1E4EA]" />
              <p className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: CORAL }}>
                Today&apos;s session
              </p>

              {/* Q2 — Session value 1–5 */}
              <fieldset>
                <legend className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.25em] text-[#6F7883] font-bold mb-2 block">
                  How valuable was today&apos;s session? <span style={{ color: CORAL }}>*</span>
                </legend>
                <div className="grid grid-cols-5 gap-1.5">
                  {SESSION_SCALE.map((n) => {
                    const isSelected = sessionValue === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSessionValue(n)}
                        className={`relative border p-3 transition-all duration-200 ${
                          isSelected ? "border-transparent" : "border-[#E1E4EA] bg-white hover:border-[#041C32]/40"
                        }`}
                        style={isSelected ? { backgroundColor: EMERALD } : undefined}
                        aria-pressed={isSelected}
                        aria-label={`${n}${n === SESSION_VALUE_MIN ? ` — ${SESSION_VALUE_LOW_LABEL}` : ""}${n === SESSION_VALUE_MAX ? ` — ${SESSION_VALUE_HIGH_LABEL}` : ""}`}
                      >
                        <span className={`block font-(family-name:--font-geist-pixel-square) text-lg md:text-xl font-bold ${isSelected ? "text-[#041C32]" : "text-[#041C32]/70"}`}>
                          {n}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6F7883]">{SESSION_VALUE_LOW_LABEL}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6F7883]">{SESSION_VALUE_HIGH_LABEL}</span>
                </div>
              </fieldset>

              {/* Q3 — Most useful */}
              <div>
                <FieldLabel htmlFor="mostUseful">What was most useful — or what would&apos;ve made it better?</FieldLabel>
                <textarea id="mostUseful" name="mostUseful" required rows={4} className={`${inputClass} resize-y`} placeholder="A sentence or two is plenty." />
              </div>

              {/* Section: Keep the conversation going */}
              <div className="h-px bg-[#E1E4EA]" />
              <p className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: CORAL }}>
                Keep the conversation going
              </p>

              {/* Q4 — Talk further */}
              <ChoiceGroup
                legend="Would you like to talk further about AI in your operations?"
                options={TALK_FURTHER_OPTIONS}
                value={talkFurther}
                onChange={setTalkFurther}
              />

              {/* Section: A bit about you */}
              <div className="h-px bg-[#E1E4EA]" />
              <p className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: CORAL }}>
                A bit about you
              </p>

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
                <ChoiceGroup
                  legend="Your industry"
                  options={INDUSTRY_OPTIONS}
                  value={industry}
                  onChange={(v) => setIndustry(v)}
                />
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

              {/* Section: Attribution */}
              <div className="h-px bg-[#E1E4EA]" />
              <p className="font-(family-name:--font-geist-pixel-square) text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: CORAL }}>
                Attribution
              </p>

              {/* Q10 — Heard about */}
              <ChoiceGroup
                legend="How did you hear about today's session?"
                options={HEARD_ABOUT_OPTIONS}
                value={heardAbout}
                onChange={setHeardAbout}
              />

              {status === "error" && errorMsg && (
                <p className="text-xs font-(family-name:--font-geist-pixel-square)" style={{ color: CORAL }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full text-[#041C32] font-(family-name:--font-geist-pixel-square) font-bold text-xs uppercase tracking-widest py-4 px-6 transition-all hover:bg-[#041C32] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: CORAL }}
              >
                {status === "submitting" ? "Sending..." : "Send feedback"}
              </button>

              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6F7883] leading-relaxed">
                Presented by Digital Canvas · 434 Media. Your responses are used to improve future sessions.
              </p>
            </motion.form>
          )}
        </div>
      </section>
    </main>
  )
}

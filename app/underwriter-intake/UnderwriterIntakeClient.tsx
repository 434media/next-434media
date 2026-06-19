"use client"

import { useState } from "react"
import { VERTICAL_LABELS, type Vertical } from "@/types/crm-types"

const VERTICALS = Object.keys(VERTICAL_LABELS) as Vertical[]

const LABEL = "block font-geist-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-1.5"
const FIELD =
  "w-full px-3.5 py-2.5 text-sm font-geist-sans bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-900 transition-colors"
const HINT = "mt-1 font-geist-sans text-[12px] text-gray-400 leading-snug"

type Form = {
  underwriterName: string
  underwriterRole: string
  sponsorName: string
  contactEmail: string
  title: string
  vertical: Vertical
  problemStatement: string
  whoIsAffected: string
  currentWorkaround: string
  costImpact: string
  frequency: string
}

const EMPTY: Form = {
  underwriterName: "",
  underwriterRole: "",
  sponsorName: "",
  contactEmail: "",
  title: "",
  vertical: "cybersecurity",
  problemStatement: "",
  whoIsAffected: "",
  currentWorkaround: "",
  costImpact: "",
  frequency: "",
}

export function UnderwriterIntakeClient() {
  const [form, setForm] = useState<Form>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/public/painpoint-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.success) throw new Error(body.error ?? "Something went wrong. Please try again.")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="font-ggx88 font-black text-2xl text-gray-900 mb-2">Thank you</h2>
        <p className="font-geist-sans text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
          Your problem has been submitted to the Digital Canvas team. We review every intake and will reach out at{" "}
          <span className="text-gray-900 font-medium">{form.contactEmail}</span> if it's a fit for an upcoming cohort.
        </p>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY)
            setDone(false)
          }}
          className="mt-6 font-geist-mono text-[12px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-900 transition-colors"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* About you */}
      <fieldset className="space-y-4">
        <legend className="font-geist-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
          About you
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Name *</label>
            <input required value={form.underwriterName} onChange={set("underwriterName")} className={FIELD} placeholder="Jane Doe" />
          </div>
          <div>
            <label className={LABEL}>Role / title</label>
            <input value={form.underwriterRole} onChange={set("underwriterRole")} className={FIELD} placeholder="VP, Security Operations" />
          </div>
          <div>
            <label className={LABEL}>Organization *</label>
            <input required value={form.sponsorName} onChange={set("sponsorName")} className={FIELD} placeholder="Acme Security Inc." />
          </div>
          <div>
            <label className={LABEL}>Contact email *</label>
            <input required type="email" value={form.contactEmail} onChange={set("contactEmail")} className={FIELD} placeholder="jane@acme.com" />
          </div>
        </div>
      </fieldset>

      {/* The problem */}
      <fieldset className="space-y-4">
        <legend className="font-geist-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3">
          The problem
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={LABEL}>Short title *</label>
            <input required value={form.title} onChange={set("title")} className={FIELD} placeholder="SOC analysts drown in false-positive alerts" />
          </div>
          <div>
            <label className={LABEL}>Industry *</label>
            <select value={form.vertical} onChange={set("vertical")} className={FIELD}>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Describe the problem *</label>
          <textarea required rows={4} value={form.problemStatement} onChange={set("problemStatement")} className={FIELD} placeholder="What is the operational problem, in your own words?" />
          <p className={HINT}>Be concrete. The best submissions describe one specific, recurring problem — not a broad theme.</p>
        </div>
      </fieldset>

      {/* Make it specific */}
      <fieldset className="space-y-4">
        <legend className="font-geist-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-1">
          Make it specific
        </legend>
        <p className="font-geist-sans text-[12px] text-gray-400 leading-snug mb-2">
          Optional, but the more of these you answer, the faster we can match it to a builder team.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Who's affected?</label>
            <input value={form.whoIsAffected} onChange={set("whoIsAffected")} className={FIELD} placeholder="Tier-1 SOC analysts" />
          </div>
          <div>
            <label className={LABEL}>How often does it happen?</label>
            <input value={form.frequency} onChange={set("frequency")} className={FIELD} placeholder="Every shift / per incident" />
          </div>
        </div>
        <div>
          <label className={LABEL}>What do you do about it today?</label>
          <textarea rows={2} value={form.currentWorkaround} onChange={set("currentWorkaround")} className={FIELD} placeholder="The current workaround — even a manual one" />
        </div>
        <div>
          <label className={LABEL}>What does it cost you?</label>
          <input value={form.costImpact} onChange={set("costImpact")} className={FIELD} placeholder="~$2M/yr in analyst time + missed breaches" />
          <p className={HINT}>Time, money, or risk — a rough estimate is fine.</p>
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 font-geist-sans text-[13px] text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-6 py-3 font-geist-sans text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit problem"}
      </button>
      <p className="font-geist-sans text-[11px] text-gray-300 leading-snug">
        Protected by bot detection. We use your submission only to evaluate fit for a Digital Canvas cohort.
      </p>
    </form>
  )
}

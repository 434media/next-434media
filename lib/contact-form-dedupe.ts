// Pure (no Firestore), so it is tested directly (lib/__tests__/contact-form-dedupe.test.ts).
import type { ContactFormSubmission } from "./firestore-contact-forms"

/** A second identical submission this soon after the first is a double submit, not a new inquiry. */
const DOUBLE_SUBMIT_MS = 60 * 1000

/**
 * Deduplicate contact form submissions by email+source+name. An AIM submission mirrored in the default database is
 * shown once, as the default copy. In the default database only a double submit collapses (the same message within
 * a minute); any other repeat from the same person is a new inquiry and stays. Collapsing every repeat hid a
 * second inquiry from the People Inbox (2026-11-17).
 */
export function deduplicateContactForms(submissions: ContactFormSubmission[]): ContactFormSubmission[] {
  const key = (sub: ContactFormSubmission) => `${sub.email.toLowerCase()}|${sub.source}|${sub.firstName}|${sub.lastName}`
  const time = (sub: ContactFormSubmission) => Date.parse(sub.created_at) || 0
  const defaultSubs = submissions.filter((sub) => sub._dbSource === "default").sort((x, y) => time(x) - time(y))
  const kept: ContactFormSubmission[] = []
  const lastKept = new Map<string, ContactFormSubmission>()
  for (const sub of defaultSubs) {
    const k = key(sub)
    const prev = lastKept.get(k)
    const doubleSubmit =
      prev !== undefined && (prev.message ?? "").trim() === (sub.message ?? "").trim() && time(sub) - time(prev) < DOUBLE_SUBMIT_MS
    if (doubleSubmit) continue
    kept.push(sub)
    lastKept.set(k, sub)
  }
  const others = new Map<string, ContactFormSubmission>()
  for (const sub of submissions) {
    if (sub._dbSource === "default") continue
    const k = key(sub)
    if (!lastKept.has(k) && !others.has(k)) others.set(k, sub)
  }
  return [...kept, ...others.values()]
}

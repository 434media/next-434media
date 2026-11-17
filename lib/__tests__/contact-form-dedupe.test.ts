/**
 * Offline. A repeat inquiry from the same person stays in the list (2026-11-17: the second Proof Run inquiry was
 * collapsed into the first and never reached the People Inbox); a double submit still shows once. Invented addresses
 * on the reserved .test domain.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { deduplicateContactForms } from "../contact-form-dedupe"
import type { ContactFormSubmission } from "../firestore-contact-forms"

const sub = (id: string, db: "default" | "aimsatx", at: string, message = "We need a series.", source = "434 Media"): ContactFormSubmission =>
  ({ id, firstName: "Ana", lastName: "Ruiz", company: "", email: "Ana@Example.test", source, message, created_at: at, _dbSource: db }) as ContactFormSubmission

const ids = (list: ContactFormSubmission[]) => list.map((s) => s.id).sort()

test("a repeat inquiry from the same person stays, even with the same message", () => {
  assert.deepEqual(ids(deduplicateContactForms([sub("a", "default", "2026-11-17T02:14:00Z"), sub("b", "default", "2026-11-17T02:40:00Z")])), ["a", "b"])
})

test("a repeat inquiry with a different message stays, however soon", () => {
  assert.deepEqual(ids(deduplicateContactForms([sub("a", "default", "2026-11-17T02:14:00Z"), sub("b", "default", "2026-11-17T02:15:00Z", "Also a podcast.")])), ["a", "b"])
})

test("a double submit (same message within ten minutes) shows once, as the first", () => {
  assert.deepEqual(ids(deduplicateContactForms([sub("b", "default", "2026-11-17T02:14:20Z"), sub("a", "default", "2026-11-17T02:14:00Z")])), ["a"])
})

test("an AIM copy of a default submission is shown once, as the default copy", () => {
  assert.deepEqual(ids(deduplicateContactForms([sub("aim1", "aimsatx", "2026-11-17T02:14:00Z", "x", "AIM"), sub("d1", "default", "2026-11-17T02:14:00Z", "x", "AIM")])), ["d1"])
})

test("AIM submissions with no default copy show once", () => {
  const out = deduplicateContactForms([sub("aim1", "aimsatx", "2026-11-17T02:14:00Z", "x", "AIM"), sub("aim2", "aimsatx", "2026-11-17T03:14:00Z", "x", "AIM")])
  assert.deepEqual(ids(out), ["aim1"])
})

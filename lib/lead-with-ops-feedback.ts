/**
 * Shared option sets + types for the Lead with Ops. Layer in AI. post-event
 * feedback form. Pure constants only (no server imports) so the client page and
 * the server API route can both import from here and never drift out of sync.
 *
 * Mirrors the 10-question "Lunch and Learn Feedback" Google Form:
 *   1. Email
 *   2. How valuable was today's session? (1 = Very Valuable … 5 = Not Valuable)
 *   3. What was most useful — or what would've made it better?
 *   4. Would you like to talk further about AI in your operations?
 *   5. Name
 *   6. Company
 *   7. Your Role
 *   8. Your Industry
 *   9. What's your single biggest question or blocker with AI right now?
 *  10. How did you hear about today's session?
 */

/**
 * Firestore collection, in the `digitalcanvas` named database, for feedback
 * rows. Unchanged by the 2026-10 move from the Digital Canvas site, so rows
 * written there and here sit together.
 */
export const FEEDBACK_COLLECTION = "event-feedback"

/** The session, as recorded on every row. Copied from the Digital Canvas site. */
export const EVENT_ID = "LeadWithOpsLayerInAI-2026-06-18"
export const EVENT_NAME = "Lead with Ops. Layer in AI."
export const EVENT_DATE = "2026-06-18"

/** Q2 — session value scale. 1 = Very Valuable, 5 = Not Valuable. */
export const SESSION_VALUE_MIN = 1
export const SESSION_VALUE_MAX = 5
export const SESSION_VALUE_LOW_LABEL = "Very Valuable"
export const SESSION_VALUE_HIGH_LABEL = "Not Valuable"

/** Q4 — interest in a follow-up conversation. */
export const TALK_FURTHER_OPTIONS = [
  "Yes, let's set up a call",
  "Maybe, send me the self-assessment and I'll reach out",
  "Not right now, just here to learn",
] as const

/** Q7 — role. "Other" is a plain option (no free-text per the form). */
export const ROLE_OPTIONS = [
  "Owner / CEO / President",
  "C-suite / Partner",
  "VP / Director",
  "Manager",
  "Other",
] as const

/** Q8 — industry. "Other" reveals a short-answer field (per the form). */
export const INDUSTRY_OPTIONS = [
  "Commercial Real Estate",
  "Private Equity",
  "Construction",
  "Financial Services",
  "Family Office",
  "Other",
] as const

/** Q10 — attribution. */
export const HEARD_ABOUT_OPTIONS = [
  "434 Media / Digital Canvas email",
  "LinkedIn",
  "Adam Carroll",
  "A colleague or friend",
  "VelocityTX",
  "Other",
] as const

export type TalkFurther = (typeof TALK_FURTHER_OPTIONS)[number]
export type Role = (typeof ROLE_OPTIONS)[number]
export type Industry = (typeof INDUSTRY_OPTIONS)[number]
export type HeardAbout = (typeof HEARD_ABOUT_OPTIONS)[number]

/**
 * Length caps, enforced by the route and mirrored as maxLength on the form.
 * Email follows RFC 5321's 254. The whole request body is capped too, well
 * above what the caps allow, so an oversized payload is refused before parsing.
 */
export const MAX_LENGTH = {
  email: 254,
  name: 200,
  company: 200,
  industryOther: 200,
  mostUseful: 2000,
  biggestQuestion: 2000,
} as const
export const MAX_BODY_BYTES = 16 * 1024

/** The free-text "Other" sentinel shared by the industry field. */
export const OTHER_OPTION = "Other"

/** Same check the Digital Canvas site's feedback route used (its lib/utils.ts). */
export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)
}

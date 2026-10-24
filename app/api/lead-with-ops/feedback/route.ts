import { NextResponse } from "next/server"
import { getNamedDb, NAMED_DATABASES } from "@/lib/firebase-admin"
import {
  EVENT_ID,
  EVENT_NAME,
  EVENT_DATE,
  isValidEmail,
  FEEDBACK_COLLECTION,
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

const isDevelopment = process.env.NODE_ENV === "development"

/**
 * Post-event feedback intake for the Lead with Ops. Layer in AI. lunch.
 * One write into the `digitalcanvas` named database; sends no email and does
 * not dedupe (an attendee may resubmit; each submission is its own row).
 *
 * Moved from the Digital Canvas site in 2026-10 with its validation unchanged.
 * Rows keep `source: "web-digitalcanvas"` (the brand the form belongs to, and
 * the value the CRM already maps) and gain `site`, which records where the
 * form was served.
 *
 * Unlike registration, this endpoint is intentionally NOT behind Vercel BotID.
 * Feedback is a low-value target for bots, and the client-side BotID challenge
 * can silently hang for legitimate attendees (privacy extensions / ad blockers
 * return an empty body for the challenge script, so the wrapped fetch never
 * resolves). For a form we want every attendee to complete, reliable delivery
 * beats bot protection here. (Registration, when it ran on the Digital Canvas
 * site, was behind BotID.)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
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
    }: {
      email?: string
      name?: string
      company?: string
      sessionValue?: number | string
      mostUseful?: string
      talkFurther?: string
      role?: string
      industry?: string
      industryOther?: string
      biggestQuestion?: string
      heardAbout?: string
    } = body

    // --- Required free-text + identity fields -------------------------------
    const requiredText: Record<string, unknown> = { email, name, company, mostUseful, biggestQuestion }
    for (const [field, value] of Object.entries(requiredText)) {
      if (typeof value !== "string" || value.trim().length === 0) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    const normalizedEmail = (email as string).toLowerCase().trim()
    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // --- Q2: session value (1–5) -------------------------------------------
    const valueNumeric = typeof sessionValue === "string" ? Number.parseInt(sessionValue, 10) : sessionValue
    if (
      typeof valueNumeric !== "number" ||
      Number.isNaN(valueNumeric) ||
      valueNumeric < SESSION_VALUE_MIN ||
      valueNumeric > SESSION_VALUE_MAX
    ) {
      return NextResponse.json(
        { error: `sessionValue must be a number from ${SESSION_VALUE_MIN} to ${SESSION_VALUE_MAX}` },
        { status: 400 },
      )
    }

    // --- Single-choice enums ------------------------------------------------
    const enumChecks: { field: string; value: unknown; allowed: readonly string[] }[] = [
      { field: "talkFurther", value: talkFurther, allowed: TALK_FURTHER_OPTIONS },
      { field: "role", value: role, allowed: ROLE_OPTIONS },
      { field: "industry", value: industry, allowed: INDUSTRY_OPTIONS },
      { field: "heardAbout", value: heardAbout, allowed: HEARD_ABOUT_OPTIONS },
    ]
    for (const { field, value, allowed } of enumChecks) {
      if (typeof value !== "string" || !allowed.includes(value)) {
        return NextResponse.json({ error: `${field} must be one of the provided options` }, { status: 400 })
      }
    }

    // --- Q8: "Other" industry requires a short answer ----------------------
    const trimmedIndustryOther =
      typeof industryOther === "string" ? industryOther.trim() : ""
    if (industry === OTHER_OPTION && trimmedIndustryOther.length === 0) {
      return NextResponse.json(
        { error: "Please specify your industry" },
        { status: 400 },
      )
    }

    // --- Persist ------------------------------------------------------------
    // Always fail the request on Firestore errors (dev included) so the form
    // never shows a misleading success state when no data was actually saved.
    try {
      const db = getNamedDb(NAMED_DATABASES.DIGITALCANVAS)
      await db.collection(FEEDBACK_COLLECTION).add({
        email: normalizedEmail,
        name: (name as string).trim(),
        company: (company as string).trim(),
        sessionValue: valueNumeric,
        sessionValueScale: `${SESSION_VALUE_MIN} (${SESSION_VALUE_LOW_LABEL}) – ${SESSION_VALUE_MAX} (${SESSION_VALUE_HIGH_LABEL})`,
        mostUseful: (mostUseful as string).trim(),
        talkFurther,
        role,
        industry,
        ...(industry === OTHER_OPTION ? { industryOther: trimmedIndustryOther } : {}),
        biggestQuestion: (biggestQuestion as string).trim(),
        heardAbout,
        event: EVENT_ID,
        eventName: EVENT_NAME,
        eventDate: EVENT_DATE,
        submittedAt: new Date().toISOString(),
        source: "web-digitalcanvas",
        site: "434media.com",
        tags: [
          "event-feedback",
          "lead-with-ops-2026-06-18",
          ...(talkFurther === TALK_FURTHER_OPTIONS[0] ? ["feedback-wants-call"] : []),
        ],
        pageUrl: request.headers.get("referer") || null,
      })

      console.log(`Lead with Ops feedback saved for ${normalizedEmail}`)
    } catch (firestoreError) {
      const message = firestoreError instanceof Error ? firestoreError.message : String(firestoreError)
      console.error("Firestore error:", message)
      return NextResponse.json(
        {
          error: isDevelopment
            ? `Feedback could not be saved: ${message}`
            : "Feedback service temporarily unavailable. Please try again or contact us directly.",
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { message: "Feedback received", data: { name: (name as string).trim() } },
      { status: 200 },
    )
  } catch (error) {
    console.error("Feedback error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    )
  }
}

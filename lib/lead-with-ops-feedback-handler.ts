import { NextResponse } from "next/server"
import { isAllowedFormOrigin } from "@/lib/request-origin"
import {
  MAX_LENGTH,
  MAX_BODY_BYTES,
  EVENT_ID,
  EVENT_NAME,
  EVENT_DATE,
  isValidEmail,
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
import { callRequestMessage, type CallRequestMessage } from "@/lib/lead-with-ops-call-request"

type FeedbackBody = {
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
}

const isDevelopment = process.env.NODE_ENV === "development"

export interface FeedbackDeps {
  requireHuman: () => Promise<{ ok: true } | { ok: false; response: Response }>
  saveRow: (row: Record<string, unknown>) => Promise<void>
  /** Sends the call-request email; throws on failure. */
  sendCallRequest: (message: CallRequestMessage) => Promise<void>
  now?: () => Date
}

/**
 * Post-event feedback intake for the Lead with Ops. Layer in AI. lunch.
 * One write into the `digitalcanvas` named database, and no dedupe (an
 * attendee may resubmit; each submission is its own row). After the write, a
 * "Yes, let's set up a call" answer sends one email to Carroll Strategy &
 * Operations with the founder copied (lib/lead-with-ops-call-request.ts); the
 * other two answers send nothing. A failed send is logged and the submission
 * still succeeds, because the row is already saved.
 *
 * Moved from the Digital Canvas site in 2026-10 with its validation unchanged.
 * Rows keep `source: "web-digitalcanvas"` (the brand the form belongs to, and
 * the value the CRM already maps) and gain `site`, which records where the
 * form was served.
 *
 * Guards, in order (review of next-434media#225, 2026-10-24): JSON content
 * type, an allowed Origin (lib/request-origin.ts), a body-size cap, Vercel
 * BotID like every public form here, then a length cap on every string field.
 *
 * On Digital Canvas this route skipped BotID, because the client challenge can
 * hang for an attendee whose blocker empties the challenge script. The form's
 * 15-second abort now bounds that: the attendee sees a retryable error rather
 * than a stuck button, and VIP@434MEDIA.COM is on the page.
 *
 * The route file wires the real BotID check, Firestore and Resend into
 * `deps`; tests pass fakes (lib/__tests__/lead-with-ops-feedback.test.ts).
 */
export async function handleFeedbackPost(request: Request, deps: FeedbackDeps): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 })
    }

    if (!isAllowedFormOrigin(request)) {
      return NextResponse.json({ error: "Request blocked" }, { status: 403 })
    }

    const declared = Number(request.headers.get("content-length") || 0)
    if (declared > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 })
    }
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 })
    }

    const human = await deps.requireHuman()
    if (!human.ok) return human.response

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
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
    } = body as FeedbackBody

    // --- Length caps --------------------------------------------------------
    const capped: Record<keyof typeof MAX_LENGTH, unknown> = { email, name, company, industryOther, mostUseful, biggestQuestion }
    for (const [field, value] of Object.entries(capped) as [keyof typeof MAX_LENGTH, unknown][]) {
      if (value !== undefined && typeof value !== "string") {
        return NextResponse.json({ error: `${field} must be text` }, { status: 400 })
      }
      if (typeof value === "string" && value.trim().length > MAX_LENGTH[field]) {
        return NextResponse.json({ error: `${field} must be ${MAX_LENGTH[field]} characters or fewer` }, { status: 400 })
      }
    }

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
    const submittedAt = (deps.now?.() ?? new Date()).toISOString()
    try {
      await deps.saveRow({
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
        submittedAt,
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

    // --- Call request: tell Carroll, after the row is safely saved ----------
    if (talkFurther === TALK_FURTHER_OPTIONS[0]) {
      try {
        await deps.sendCallRequest(
          callRequestMessage({
            name: (name as string).trim(),
            email: normalizedEmail,
            company: (company as string).trim(),
            role: role as string,
            industry: industry as string,
            ...(industry === OTHER_OPTION ? { industryOther: trimmedIndustryOther } : {}),
            mostUseful: (mostUseful as string).trim(),
            biggestQuestion: (biggestQuestion as string).trim(),
            submittedAt,
          }),
        )
        console.log(`Lead with Ops call request emailed for ${normalizedEmail}`)
      } catch (emailError) {
        // The row is saved and tagged feedback-wants-call; the submitter still
        // gets their success state. Someone forwards it by hand from the log.
        const message = emailError instanceof Error ? emailError.message : String(emailError)
        console.error(`Lead with Ops call request email failed for ${normalizedEmail}:`, message)
      }
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

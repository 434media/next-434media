import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { capturePartnerListMember } from "@/lib/firestore-partner-list-members"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * POST /api/admin/leads/import-partner-list
 *
 * One-shot import of a partner-shared roster (e.g. Alamo Angels members) into
 * the audience-side `partner_list_members` collection. Members live there as
 * audience cohorts until explicitly promoted into the `leads` pipeline (via
 * the future /api/admin/leads/promote-from-audience endpoint).
 *
 * Each row maps to one PartnerListMember via capturePartnerListMember, which
 * dedupes by email — re-importing an updated list refreshes tags / notes /
 * blank fields without creating duplicates.
 *
 * The CSV parsing + column mapping happens client-side: this endpoint accepts
 * already-normalized rows so the user can preview the mapping before commit.
 *
 * URL kept under /admin/leads/ for backwards compatibility with the existing
 * importer UI; the data target is now audience-side.
 *
 * Body:
 *   {
 *     partnerSlug: "alamo-angels",
 *     partnerName: "Alamo Angels",
 *     dryRun?: boolean,
 *     rows: [{ email, firstName?, lastName?, preferredName?, company?,
 *              phone?, linkedin?, joinedAt?, extraTags?, noteSuffix? }, ...]
 *   }
 *
 * Returns per-row outcomes so the UI can surface a "12 created · 3 updated ·
 * 2 skipped" summary plus a row-level error list.
 */

interface ImportRow {
  email: string
  firstName?: string
  lastName?: string
  preferredName?: string
  company?: string
  phone?: string
  linkedin?: string
  joinedAt?: string
  extraTags?: string[]
  noteSuffix?: string
}

interface ImportBody {
  partnerSlug?: string
  partnerName?: string
  dryRun?: boolean
  rows?: ImportRow[]
}

interface ImportResult {
  attempted: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ email: string; error: string }>
  // Per-row outcome shape lets the UI render a per-row status column on the
  // preview screen.
  outcomes: Array<{
    email: string
    status: "created" | "updated" | "skipped" | "failed"
    memberId?: string
    error?: string
  }>
}

const HARD_LIMIT = 5000

function isPlausibleEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@") && value.length > 3
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: ImportBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const partnerSlug = (body.partnerSlug || "").trim().toLowerCase()
  const partnerName = (body.partnerName || "").trim()
  const dryRun = !!body.dryRun
  const rows = Array.isArray(body.rows) ? body.rows : []

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(partnerSlug)) {
    return NextResponse.json(
      { error: 'partnerSlug must be a kebab-case identifier (e.g. "alamo-angels")' },
      { status: 400 },
    )
  }
  if (!partnerName) {
    return NextResponse.json(
      { error: "partnerName is required (display name shown on lead cards)" },
      { status: 400 },
    )
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "rows array is empty" }, { status: 400 })
  }
  if (rows.length > HARD_LIMIT) {
    return NextResponse.json(
      { error: `Max ${HARD_LIMIT} rows per request — split larger imports` },
      { status: 400 },
    )
  }

  const result: ImportResult = {
    attempted: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    outcomes: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : ""

    if (!isPlausibleEmail(email)) {
      result.skipped++
      result.outcomes.push({
        email: email || `(row ${i})`,
        status: "skipped",
        error: "Invalid or missing email",
      })
      continue
    }

    if (dryRun) {
      // We can't truly dry-run dedup (would need a Firestore read per row,
      // which doubles the request cost). The preview screen surfaces the
      // dedup result via the up-front /find-by-email lookup it does
      // separately. Here we just count rows that *would* be attempted.
      result.outcomes.push({ email, status: "created" })
      continue
    }

    try {
      const outcome = await capturePartnerListMember({
        email,
        firstName: row.firstName?.trim() || undefined,
        lastName: row.lastName?.trim() || undefined,
        preferredName: row.preferredName?.trim() || undefined,
        company: row.company?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        linkedin: row.linkedin?.trim() || undefined,
        partnerSlug,
        partnerName,
        joinedAt: row.joinedAt?.trim() || undefined,
        extraTags: Array.isArray(row.extraTags)
          ? row.extraTags.map(String).filter(Boolean)
          : undefined,
        noteSuffix: row.noteSuffix?.trim() || undefined,
      })

      if (outcome.created) {
        result.created++
        result.outcomes.push({ email, status: "created", memberId: outcome.id })
      } else {
        result.updated++
        result.outcomes.push({ email, status: "updated", memberId: outcome.id })
      }
    } catch (err) {
      result.failed++
      const message = err instanceof Error ? err.message : "Unknown error"
      result.errors.push({ email, error: message })
      result.outcomes.push({ email, status: "failed", error: message })
    }
  }

  if (dryRun) {
    result.created = rows.length - result.skipped
  }

  console.log(
    `[import-partner-list] ${auth.session.email} (${partnerSlug})`,
    JSON.stringify({
      attempted: result.attempted,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      dryRun,
    }),
  )

  return NextResponse.json({ ok: true, dryRun, result })
}

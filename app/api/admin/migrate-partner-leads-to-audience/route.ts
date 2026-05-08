import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb } from "@/lib/firebase-admin"
import { CRM_COLLECTIONS } from "@/types/crm-types"
import {
  capturePartnerListMember,
  findPartnerListMemberByEmail,
} from "@/lib/firestore-partner-list-members"
import type { Lead } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * POST /api/admin/migrate-partner-leads-to-audience
 *
 * One-shot migration: copies every Lead with `source: "partner"` into the
 * `partner_list_members` collection (audience-side), then archives the source
 * Lead with a migration note. Idempotent — re-runs are safe (already-migrated
 * rows are detected by email lookup and skipped).
 *
 * Default behavior is a DRY RUN — counts only, no writes. Pass ?confirm=true
 * to actually perform the migration.
 *
 * Auth: admin session required.
 */

interface MigrationOutcome {
  totalSourcePartnerLeads: number
  willMigrate: number
  alreadyMigrated: number
  noEmail: number
  errors: number
  errorDetails: Array<{ leadId: string; email: string; error: string }>
  archived: number
  // Set on confirmed runs only.
  created: number
  updated: number
}

// Two auth paths so the migration is runnable from either an authenticated
// browser session OR a curl invocation with the cron secret (matches the
// pattern used for the Instagram snapshot cron). One-shot ops on the boundary
// of admin-tooling and ops-tooling benefit from both entry points.
async function requireAuth(request: NextRequest) {
  const session = await getSession()
  if (session) {
    if (!isAuthorizedAdmin(session.email)) {
      return { error: "Forbidden: Admin access required", status: 403 as const }
    }
    return { session, actor: session.email }
  }

  const expected = process.env.CRON_SECRET
  if (expected) {
    const querySecret = request.nextUrl.searchParams.get("secret")
    const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""
    if (querySecret === expected || headerSecret === expected) {
      return { actor: "cron-secret" }
    }
  }

  return { error: "Unauthorized", status: 401 as const }
}

// Pull "Alamo Angels" out of "[2024-08-12] Imported from Alamo Angels — extra".
// Returns null if the note doesn't match the captureLeadFromPartnerList format.
function extractPartnerNameFromNotes(notes: string | undefined): string | null {
  if (!notes) return null
  // Look at every line — re-imports append additional lines, but they all
  // share the same partner so the first match wins.
  for (const line of notes.split("\n")) {
    const m = line.match(/Imported from ([^—\n]+?)(?:\s+—\s+|$)/)
    if (m) return m[1].trim()
  }
  return null
}

// Pull partner slug from tags like "partner:alamo-angels".
function extractPartnerSlug(tags: string[] | undefined): string | null {
  if (!tags) return null
  for (const tag of tags) {
    if (tag.startsWith("partner:")) {
      const slug = tag.slice("partner:".length).trim()
      if (slug) return slug
    }
  }
  return null
}

function unslugify(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

// Best-effort first/last split from a single name string.
function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const confirm = request.nextUrl.searchParams.get("confirm") === "true"
  const dryRun = !confirm

  const db = getDb()
  const outcome: MigrationOutcome = {
    totalSourcePartnerLeads: 0,
    willMigrate: 0,
    alreadyMigrated: 0,
    noEmail: 0,
    errors: 0,
    errorDetails: [],
    archived: 0,
    created: 0,
    updated: 0,
  }

  let snap: FirebaseFirestore.QuerySnapshot
  try {
    snap = await db.collection(CRM_COLLECTIONS.LEADS).where("source", "==", "partner").get()
  } catch (err) {
    console.error("[migrate-partner-leads] query failed:", err)
    return NextResponse.json(
      { error: "Failed to read source partner leads", details: String(err) },
      { status: 500 },
    )
  }

  outcome.totalSourcePartnerLeads = snap.size

  for (const doc of snap.docs) {
    const lead = { id: doc.id, ...doc.data() } as Lead
    const email = (lead.email || "").trim().toLowerCase()

    if (!email) {
      outcome.noEmail++
      continue
    }

    try {
      const existing = await findPartnerListMemberByEmail(email)
      if (existing) {
        outcome.alreadyMigrated++
        // Even on a re-run, we still want to archive the source Lead so the
        // /admin/leads page is fully cleaned up.
        if (!dryRun && lead.status !== "archived") {
          await db.collection(CRM_COLLECTIONS.LEADS).doc(lead.id).update({
            status: "archived",
            updated_at: new Date().toISOString(),
            notes: [
              lead.notes,
              `[${new Date().toISOString().split("T")[0]}] Migrated to partner_list_members (member id: ${existing.id})`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          })
          outcome.archived++
        }
        continue
      }

      outcome.willMigrate++
      if (dryRun) continue

      const partnerSlug = extractPartnerSlug(lead.tags) || "unknown"
      const partnerName =
        extractPartnerNameFromNotes(lead.notes) || unslugify(partnerSlug) || "Unknown"

      const { firstName, lastName } = splitName(lead.name || "")

      const result = await capturePartnerListMember({
        email,
        firstName,
        lastName,
        // Lead doesn't carry preferredName as a first-class field; the original
        // capture flow folded preferredName into `name`, so we leave it.
        company: lead.company || undefined,
        phone: lead.phone || undefined,
        linkedin: lead.linkedin || undefined,
        partnerSlug,
        partnerName,
        joinedAt: lead.created_at,
        // Strip the legacy "source:partner" tag (redundant — every member is
        // partner-source by collection). Keep "partner:<slug>" since the
        // capture helper would re-add it anyway, plus any free-form tags.
        extraTags: (lead.tags ?? []).filter((t) => t !== "source:partner"),
      })

      if (result.created) outcome.created++
      else outcome.updated++

      // Archive the source lead so /admin/leads no longer shows it.
      await db.collection(CRM_COLLECTIONS.LEADS).doc(lead.id).update({
        status: "archived",
        updated_at: new Date().toISOString(),
        notes: [
          lead.notes,
          `[${new Date().toISOString().split("T")[0]}] Migrated to partner_list_members (member id: ${result.id})`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      })
      outcome.archived++
    } catch (err) {
      outcome.errors++
      const message = err instanceof Error ? err.message : "Unknown error"
      outcome.errorDetails.push({
        leadId: lead.id,
        email,
        error: message,
      })
      console.error(`[migrate-partner-leads] ${email} failed:`, err)
    }
  }

  console.log(
    `[migrate-partner-leads] ${auth.actor} (dryRun=${dryRun})`,
    JSON.stringify({
      totalSourcePartnerLeads: outcome.totalSourcePartnerLeads,
      willMigrate: outcome.willMigrate,
      alreadyMigrated: outcome.alreadyMigrated,
      created: outcome.created,
      updated: outcome.updated,
      archived: outcome.archived,
      noEmail: outcome.noEmail,
      errors: outcome.errors,
    }),
  )

  return NextResponse.json({
    ok: true,
    dryRun,
    confirm,
    outcome,
    nextStep: dryRun
      ? "Re-run with ?confirm=true to perform the migration"
      : "Migration complete. Verify Audiences > Lists shows the expected cohorts.",
  })
}

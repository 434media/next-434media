import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { getClients } from "@/lib/firestore-crm"
import { getEmailSignups } from "@/lib/firestore-email-signups"

export const runtime = "nodejs"

// Lead-source values that signal Instagram attribution.
// Keep this list narrow — broadening too much causes false positives.
const IG_TEXT_MARKERS = ["instagram", "ig_bio", "ig-bio", "/ig", "@ig"]

// Page-URL UTM markers that indicate IG attribution on email signups.
// Lowercase; matched against the lowercased page_url string.
const IG_UTM_MARKERS = [
  "utm_source=instagram",
  "utm_source=ig",
  "utm_source=ig_bio",
  "ref=instagram",
  "ref=ig",
]

interface AttributedItem {
  type: "lead" | "client" | "email_signup"
  id: string
  email: string
  name: string
  source: string
  createdAt: string
  // Type-specific extras
  status?: string
  company?: string
  pageUrl?: string
}

function inRange(createdAt: string, startMs: number, endMs: number): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  if (isNaN(t)) return false
  return t >= startMs && t <= endMs
}

function lower(s: unknown): string {
  return typeof s === "string" ? s.toLowerCase() : ""
}

function matchesIgText(s: unknown): boolean {
  const v = lower(s)
  if (!v) return false
  if (v === "social") return true
  return IG_TEXT_MARKERS.some((marker) => v.includes(marker))
}

function matchesIgUtm(pageUrl: unknown): boolean {
  const v = lower(pageUrl)
  if (!v) return false
  return IG_UTM_MARKERS.some((marker) => v.includes(marker))
}

export async function GET(request: NextRequest) {
  // Admin gate
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const startDateParam = params.get("startDate")
  const endDateParam = params.get("endDate")

  if (!startDateParam || !endDateParam) {
    return NextResponse.json(
      {
        success: false,
        error: "startDate and endDate (YYYY-MM-DD) are required",
      },
      { status: 400 },
    )
  }

  const startMs = new Date(startDateParam).getTime()
  // Bump end to end-of-day so created_at ISO timestamps within the day are included.
  const endMs = new Date(endDateParam).getTime() + 24 * 60 * 60 * 1000 - 1
  if (isNaN(startMs) || isNaN(endMs)) {
    return NextResponse.json(
      { success: false, error: "startDate or endDate could not be parsed" },
      { status: 400 },
    )
  }

  try {
    // Fetch all three sources in parallel. Failures are isolated per source —
    // partial data is better than 500 here since this is a dashboard widget.
    const [leadsResult, clientsResult, signupsResult] = await Promise.allSettled([
      getLeads(),
      getClients(),
      getEmailSignups(),
    ])

    const items: AttributedItem[] = []

    // Leads — explicit source === "social" OR any free-form note containing "instagram"
    if (leadsResult.status === "fulfilled") {
      for (const lead of leadsResult.value) {
        if (!inRange(lead.created_at, startMs, endMs)) continue
        const sourceMatch = lower(lead.source) === "social"
        const notesMatch = matchesIgText(lead.notes)
        if (sourceMatch || notesMatch) {
          items.push({
            type: "lead",
            id: lead.id,
            email: lead.email,
            name: lead.name,
            source: lead.source || "social",
            createdAt: lead.created_at,
            status: lead.status,
            company: lead.company,
          })
        }
      }
    }

    // Clients — `source` or `lead_source` text contains an IG marker
    if (clientsResult.status === "fulfilled") {
      for (const client of clientsResult.value) {
        if (!inRange(client.created_at, startMs, endMs)) continue
        const sourceMatch = matchesIgText(client.source) || matchesIgText(client.lead_source)
        if (sourceMatch) {
          items.push({
            type: "client",
            id: client.id,
            email: client.email || "",
            name: client.name || client.company_name || "(unnamed)",
            source: (client.source || client.lead_source || "social") as string,
            createdAt: client.created_at,
            status: client.status,
            company: client.company_name,
          })
        }
      }
    }

    // Email signups — page_url carries UTM tags pointing at Instagram
    if (signupsResult.status === "fulfilled") {
      for (const signup of signupsResult.value) {
        if (!inRange(signup.created_at, startMs, endMs)) continue
        if (matchesIgUtm(signup.page_url)) {
          items.push({
            type: "email_signup",
            id: signup.id || signup.email,
            email: signup.email,
            name: signup.email.split("@")[0] || signup.email,
            source: signup.source || "instagram",
            createdAt: signup.created_at,
            pageUrl: signup.page_url,
          })
        }
      }
    }

    // Newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const totals = {
      leads: items.filter((i) => i.type === "lead").length,
      clients: items.filter((i) => i.type === "client").length,
      email_signups: items.filter((i) => i.type === "email_signup").length,
      all: items.length,
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        totals,
        period: { startDate: startDateParam, endDate: endDateParam },
        // Surface partial-failure info so the UI can warn if a source dropped
        warnings: [
          leadsResult.status === "rejected" && "Leads query failed",
          clientsResult.status === "rejected" && "Clients query failed",
          signupsResult.status === "rejected" && "Email signups query failed",
        ].filter(Boolean),
      },
    })
  } catch (error) {
    console.error("[attributed-leads] fatal:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to compute attributed leads",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

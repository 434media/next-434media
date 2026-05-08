import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  getInstagramPortfolioSummary,
  type InstagramRangeKey,
} from "@/lib/instagram-portfolio"

export const runtime = "nodejs"

const VALID_RANGES = new Set<InstagramRangeKey>(["today", "7d", "30d", "90d"])

function isValidRange(value: string): value is InstagramRangeKey {
  return (VALID_RANGES as Set<string>).has(value)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rangeParam = request.nextUrl.searchParams.get("range") ?? "30d"
    if (!isValidRange(rangeParam)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid range '${rangeParam}'. Valid: ${[...VALID_RANGES].join(", ")}`,
        },
        { status: 400 },
      )
    }

    const summary = await getInstagramPortfolioSummary(rangeParam)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("[api/instagram/portfolio] Failed:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: "Failed to load Instagram portfolio", details: message },
      { status: 500 },
    )
  }
}

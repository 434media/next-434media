import { NextRequest, NextResponse } from "next/server"
import { runScrape } from "@/app/lib/scraper"
import { initLeadTable } from "@/app/lib/lead-db"

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { query, urls = [], industry, location, limit } = body || {}
  if ((!urls || urls.length === 0) && !query) {
    return NextResponse.json({ error: "Provide at least one URL or a search query" }, { status: 400 })
  }

  // (Optional) TODO: Convert query to URLs via search API integration if needed.
  const cleanedUrls: string[] = Array.isArray(urls)
    ? urls.map((u: string) => u.trim()).filter(Boolean)
    : []

  if (!cleanedUrls.length && query) {
    // Placeholder: in future turn query into directory/search URLs.
    return NextResponse.json({ error: "No URLs derived from query yet. Provide URLs for now." }, { status: 400 })
  }

  try {
    await initLeadTable().catch(()=>{})
    const result = await runScrape({ query, urls: cleanedUrls, industry, location, limit })
    return NextResponse.json({ status: "complete", ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Scrape failed" }, { status: 500 })
  }
}

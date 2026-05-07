"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Sparkles,
  Search,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Lightbulb,
  Filter,
  Building2,
  Mail,
  Linkedin,
  ExternalLink,
  Ban,
  CheckCircle2,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import type { ScoredPerson } from "@/lib/prospecting/scorer"
import type { ApolloSearchFilters } from "@/lib/prospecting/apollo"

// Stage 4 — prospecting page.
//
// Rep types a free-form ICP query → translator parses → Apollo searches →
// scorer ranks → page displays scored candidates with per-dimension reasons.
// Approval flow (selected candidates → /admin/leads queue) lands in Stage 5;
// Stage 4 is read-only review.

interface SearchSuccess {
  success: true
  ambiguous: boolean
  prompt: string
  reasoning: string
  filters?: ApolloSearchFilters
  candidates?: ScoredPerson[]
  page?: number
  perPage?: number
  totalEntries?: number
  threshold?: number
  ambiguityNote?: string
  creditsUsedThisProcess?: number
}

interface SearchError {
  error: string
  source?: "anthropic" | "apollo"
  code?: string
}

const EXAMPLE_PROMPTS = [
  "Biotech founders in Texas with $20M+ revenue",
  "VPs of Marketing at mid-size CPG brands targeting Hispanic audiences",
  "Heads of Partnerships at VC firms in San Antonio",
  "CMOs at healthcare systems expanding into Texas",
]

export default function ProspectPage() {
  const [prompt, setPrompt] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<SearchSuccess | null>(null)
  const [error, setError] = useState<SearchError | null>(null)

  const handleSearch = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isSearching) return
    setIsSearching(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/admin/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, perPage: 25 }),
      })
      const data = (await res.json()) as SearchSuccess | SearchError
      if (!res.ok || "error" in data) {
        setError(data as SearchError)
        return
      }
      setResult(data as SearchSuccess)
    } catch (err) {
      setError({
        error: err instanceof Error ? err.message : "Network error",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
  }

  const candidates = result?.candidates ?? []
  const threshold = result?.threshold ?? 60
  const aboveThreshold = candidates.filter((c) => c.score >= threshold)
  const belowThreshold = candidates.filter((c) => c.score >= 0 && c.score < threshold)
  const excluded = candidates.filter((c) => c.score === -1)

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        {/* Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/leads"
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                  aria-label="Back to Leads"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <Sparkles className="w-4 h-4 text-neutral-600" />
                <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                  PROSPECT
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full">
                  natural-language ICP search
                </span>
              </div>
              {result?.creditsUsedThisProcess !== undefined && (
                <span className="text-[11px] text-neutral-500 tabular-nums">
                  {result.creditsUsedThisProcess} Apollo credits this session
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Search form */}
          <section className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 shadow-sm">
            <label
              htmlFor="prospect-prompt"
              className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2"
            >
              Describe who you're looking for
            </label>
            <textarea
              id="prospect-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter to submit — fast iteration for reps.
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              disabled={isSearching}
              rows={3}
              placeholder="e.g. Biotech founders in Texas with $20M+ revenue"
              className="w-full px-3 py-2 border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 text-[13px] text-neutral-800 leading-relaxed resize-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-[11px] text-neutral-400 hidden sm:block">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-100 border border-neutral-200 rounded">⌘</kbd>{" "}
                <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-100 border border-neutral-200 rounded">Enter</kbd>{" "}
                to search
              </span>
              <button
                onClick={handleSearch}
                disabled={!prompt.trim() || isSearching}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
          </section>

          {/* Example prompts (only shown before any search runs) */}
          {!result && !error && !isSearching && (
            <section>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <Lightbulb className="w-3 h-3" />
                Try one of these
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleExampleClick(ex)}
                    className="px-3 py-1.5 text-[12px] text-neutral-600 bg-white border border-neutral-200 rounded-full hover:border-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Loading state */}
          {isSearching && (
            <section className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
              <p className="text-[13px] text-neutral-500">
                Translating your prompt, searching Apollo, and scoring candidates…
              </p>
            </section>
          )}

          {/* Error state */}
          {error && (
            <section className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-red-800">
                    {error.error}
                  </p>
                  {error.source && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Source: {error.source}
                      {error.code && <> · {error.code}</>}
                    </p>
                  )}
                  {error.code === "plan-blocked" && (
                    <p className="text-[12px] text-red-700 mt-2 leading-relaxed">
                      The Apollo Free plan blocks this endpoint. Upgrade to Basic
                      ($49/seat/mo) at{" "}
                      <a
                        href="https://app.apollo.io/#/settings/plans"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Apollo plan settings
                      </a>
                      .
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Ambiguity surface */}
          {result?.ambiguous && (
            <section className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[13px] font-semibold text-amber-900">
                    Ambiguous query — clarify and search again
                  </p>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    {result.ambiguityNote}
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed pt-1">
                    No Apollo credits were used — we don&apos;t search until the
                    query is clear. Edit your prompt and try again.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Reasoning + filters (when search succeeded) */}
          {result && !result.ambiguous && (
            <>
              <section className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5">
                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <Lightbulb className="w-3 h-3" />
                  How I read it
                </div>
                <p className="text-[13px] text-neutral-700 leading-relaxed mb-3">
                  {result.reasoning}
                </p>
                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <Filter className="w-3 h-3" />
                  Filters used
                </div>
                <FilterChips filters={result.filters ?? {}} />
              </section>

              {/* Results tray */}
              <section>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-[15px] font-semibold text-neutral-900">
                    {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
                  </h2>
                  <div className="text-[11px] text-neutral-500 tabular-nums">
                    {aboveThreshold.length} above threshold ({threshold}+) ·{" "}
                    {belowThreshold.length} below ·{" "}
                    {excluded.length} excluded
                  </div>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                    <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-[13px] font-medium text-neutral-700">
                      No candidates returned
                    </p>
                    <p className="text-[12px] text-neutral-500 mt-1">
                      Try a broader prompt or different filters.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                    {candidates.map((c, i) => (
                      <CandidateRow
                        key={c.person.id || i}
                        candidate={c}
                        threshold={threshold}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Stage 5 will add the approval action bar here */}
              <p className="text-[11px] text-neutral-400 text-center pt-2">
                Approval flow (selected → leads queue) lands in Stage 5.
              </p>
            </>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}

// ─── sub-components ───

function FilterChips({ filters }: { filters: ApolloSearchFilters }) {
  // Build a flat list of human-readable filter chips. Skip pagination fields.
  const chips: string[] = []
  if (filters.organization_locations?.length) {
    chips.push(...filters.organization_locations.map((l) => `📍 ${l}`))
  }
  if (filters.person_titles?.length) {
    chips.push(...filters.person_titles.map((t) => `👤 ${t}`))
  }
  if (filters.person_seniorities?.length) {
    chips.push(`Seniorities: ${filters.person_seniorities.join(", ")}`)
  }
  if (filters.num_employees_ranges?.length) {
    chips.push(`Size: ${filters.num_employees_ranges.join(", ")}`)
  }
  if (filters.revenue_range?.min !== undefined) {
    chips.push(`Revenue ≥ $${filters.revenue_range.min.toLocaleString()}`)
  }
  if (filters.revenue_range?.max !== undefined) {
    chips.push(`Revenue ≤ $${filters.revenue_range.max.toLocaleString()}`)
  }
  if (filters.q_keywords) {
    chips.push(`Keywords: "${filters.q_keywords}"`)
  }
  if (filters.contact_email_status?.length) {
    chips.push(`Email: ${filters.contact_email_status.join(", ")}`)
  }
  if (chips.length === 0) {
    return (
      <p className="text-[12px] text-neutral-400 italic">
        No structured filters applied — showing broad results.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-neutral-700 bg-neutral-100"
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

function CandidateRow({
  candidate,
  threshold,
}: {
  candidate: ScoredPerson
  threshold: number
}) {
  const { person, score, breakdown, reasons, excluded } = candidate
  const isExcluded = score === -1
  const aboveThreshold = !isExcluded && score >= threshold

  // Score badge tint: green for above threshold, amber for below, red for excluded
  const scoreTint = isExcluded
    ? "bg-red-100 text-red-700 border-red-200"
    : aboveThreshold
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-amber-100 text-amber-800 border-amber-200"

  const rowOpacity = isExcluded ? "opacity-50" : aboveThreshold ? "" : "opacity-75"

  // Best-effort name display — handles Free-plan obfuscation
  const lastName = person.last_name || person.last_name_obfuscated || ""
  const displayName = `${person.first_name} ${lastName}`.trim() || "(unnamed)"

  return (
    <div className={`px-4 py-3.5 hover:bg-neutral-50/50 transition-colors ${rowOpacity}`}>
      <div className="flex items-start gap-3">
        {/* Score badge */}
        <div
          className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-md border tabular-nums ${scoreTint}`}
        >
          {isExcluded ? (
            <Ban className="w-5 h-5" />
          ) : (
            <span className="text-[16px] font-bold">{score}</span>
          )}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-neutral-900 leading-tight">
              {displayName}
            </p>
            {person.last_name_obfuscated && !person.last_name && (
              <span
                className="text-[10px] text-neutral-400"
                title="Last name hidden — Apollo Free plan masks data"
              >
                hidden
              </span>
            )}
            {aboveThreshold && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-neutral-600 mt-0.5">
            {person.title && <span>{person.title}</span>}
            {person.title && person.organization?.name && (
              <span className="text-neutral-300">·</span>
            )}
            {person.organization?.name && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3 text-neutral-400" />
                {person.organization.name}
              </span>
            )}
          </div>
          {(person.email || person.linkedin_url) && (
            <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1">
              {person.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {person.email}
                </span>
              )}
              {person.linkedin_url && (
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Linkedin className="w-3 h-3" />
                  LinkedIn
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              )}
            </div>
          )}

          {/* Score breakdown / exclusion reason */}
          {isExcluded ? (
            <p className="text-[11px] text-red-700 mt-2 leading-relaxed">
              {excluded}
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-neutral-500 tabular-nums">
              <span>
                Geo <strong className="text-neutral-700">+{breakdown.geography}</strong>
              </span>
              <span>
                Industry <strong className="text-neutral-700">+{breakdown.industry}</strong>
              </span>
              <span>
                Title <strong className="text-neutral-700">+{breakdown.title}</strong>
              </span>
              <span>
                Size <strong className="text-neutral-700">+{breakdown.companySize}</strong>
              </span>
            </div>
          )}

          {/* Detailed reasons (collapsible-ish; just shown small) */}
          {!isExcluded && (
            <details className="mt-2 group">
              <summary className="text-[11px] text-neutral-400 hover:text-neutral-700 cursor-pointer select-none">
                Show reasoning
              </summary>
              <ul className="mt-1.5 space-y-0.5 pl-3 text-[11px] text-neutral-500 leading-relaxed">
                {reasons.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

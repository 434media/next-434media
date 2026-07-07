"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Search,
  Loader2,
  AlertCircle,
  Lightbulb,
  SlidersHorizontal,
  Building2,
  Mail,
  ExternalLink,
  Ban,
  CheckCircle2,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { LinkedinIcon } from "@/components/icons/LinkedinIcon"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { LeadsTabs } from "@/components/crm/LeadsTabs"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { ScoredPerson } from "@/lib/prospecting/scorer"
import type {
  ApolloEmailStatus,
  ApolloSearchFilters,
  ApolloSeniority,
} from "@/lib/prospecting/apollo"
import {
  ARCHETYPE_PRESETS,
  draftToFilters,
  filtersToDraft,
  type ProspectDraft,
} from "@/lib/prospecting/presets"
import {
  ICP_INDUSTRIES,
  INDUSTRY_MAP,
  type IcpIndustry,
} from "@/lib/prospecting/industry-tags"

// Prospecting page — Apollo WHO/WHEN flow.
//
// Rep describes an ICP in plain language OR picks an archetype preset →
// translator derives structured filters (no credits) → rep reviews + edits the
// filters → searches Apollo (credits) → scored candidates → approve into Leads.

// Results per search. Kept at 10 (not 25) for QA cost control — each row can
// cost a reveal credit, so a smaller page limits accidental spend during
// testing. Bump back up once the QA team signs off on the environment.
const PER_PAGE = 10

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

interface TranslateResponse {
  success: true
  ambiguous: boolean
  prompt: string
  reasoning: string
  filters?: ApolloSearchFilters
  icpIndustries?: IcpIndustry[]
  nicheKeyword?: string
  ambiguityNote?: string
}

interface RequestError {
  error: string
  source?: "anthropic" | "apollo"
  code?: string
}

interface ApprovalResponse {
  success: true
  submitted: number
  created: number
  updated: number
  skipped: number
  failed: number
  revealed: number
  results: Array<{
    apolloPersonId: string
    email: string | null
    leadId: string | null
    status: "created" | "updated" | "skipped" | "failed"
    reason?: string
  }>
}

interface ApprovalToast {
  message: string
  type: "success" | "error"
}

interface BudgetStatus {
  today: number
  thisMonth: number
  thisMonthTeamWide: number
  dailyCap: number
  monthlyCap: number
  dailyRemaining: number
  monthlyRemaining: number
  remaining: number
}

// Best-practice example prompts. Each is specific on WHO (title + seniority +
// industry + geography + size/revenue) and, where useful, a WHEN signal — the
// pattern Apollo recommends for quality outbound. Mapped to the four archetypes.
const EXAMPLE_PROMPTS: { prompt: string; pattern: string }[] = [
  {
    prompt: "Heads of Partnerships and CMOs at Texas CPG and beverage brands with $20M+ revenue",
    pattern: "Sponsor-buyers · Champion + Economic Buyer, industry + geo + revenue",
  },
  {
    prompt: "Communications Directors and Founders at San Antonio healthcare systems and mission-driven nonprofits",
    pattern: "Storytelling clients · title + industry + local geo",
  },
  {
    prompt: "Executive Directors and Program Directors at Texas health and biotech accelerators that run annual summits",
    pattern: "Event partners · leader titles + ecosystem industry",
  },
  {
    prompt: "Managing Partners and Heads of Platform at Texas-focused VC firms and accelerators",
    pattern: "Ecosystem amplifiers · fund roles + capital industry",
  },
  {
    prompt: "CMOs, VPs of Marketing, and Heads of Developer Relations or Community at Texas dev-tool, cloud, and B2B SaaS companies",
    pattern: "Tech sponsors · fund hackathons, workshops & build sessions (Digital Canvas / DEVSA)",
  },
  {
    prompt: "Mid-size Texas consumer brands hiring a Head of Marketing or Brand lead in the last 90 days",
    pattern: "WHEN signal · target is staffing up its brand team = fresh budget, live buying moment",
  },
]

const SENIORITY_OPTIONS: { value: ApolloSeniority; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-suite" },
  { value: "partner", label: "Partner" },
  { value: "vp", label: "VP" },
  { value: "head", label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
]

const EMAIL_STATUS_OPTIONS: { value: ApolloEmailStatus; label: string }[] = [
  { value: "verified", label: "Verified" },
  { value: "likely to engage", label: "Likely to engage" },
  { value: "unverified", label: "Unverified" },
]

const INDUSTRY_OPTIONS: { value: IcpIndustry; label: string }[] = ICP_INDUSTRIES.map(
  (k) => ({ value: k, label: INDUSTRY_MAP[k].label }),
)

export default function ProspectPage() {
  const [prompt, setPrompt] = useState("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  // The editable draft — set by translate or by a preset; null before either.
  const [draft, setDraft] = useState<ProspectDraft | null>(null)
  const [draftReasoning, setDraftReasoning] = useState<string>("")
  const [ambiguityNote, setAmbiguityNote] = useState<string | null>(null)
  const [result, setResult] = useState<SearchSuccess | null>(null)
  // Candidates live in state (not derived from result) so a per-row reveal can
  // replace a single row with its enriched + re-scored record.
  const [candidates, setCandidates] = useState<ScoredPerson[]>([])
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<RequestError | null>(null)
  // Selection + approval state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isApproving, setIsApproving] = useState(false)
  const [approvalToast, setApprovalToast] = useState<ApprovalToast | null>(null)
  // Persistent Apollo budget
  const [budget, setBudget] = useState<BudgetStatus | null>(null)

  const loadBudget = async () => {
    try {
      const res = await fetch("/api/admin/prospecting/budget", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (data?.success) setBudget(data as BudgetStatus)
    } catch {
      // Non-fatal — page works without budget visibility.
    }
  }

  useEffect(() => {
    loadBudget()
  }, [])

  useEffect(() => {
    if (!approvalToast) return
    const t = setTimeout(() => setApprovalToast(null), 4000)
    return () => clearTimeout(t)
  }, [approvalToast])

  const resetDownstreamState = () => {
    setResult(null)
    setCandidates([])
    setRevealingIds(new Set())
    setSelectedIds(new Set())
    setApprovalToast(null)
    setError(null)
  }

  // ── Phase 1: translate prompt → editable draft (no credits) ──
  const handleTranslate = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isTranslating) return
    setIsTranslating(true)
    resetDownstreamState()
    setDraft(null)
    setAmbiguityNote(null)
    try {
      const res = await fetch("/api/admin/prospecting/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      })
      const data = (await res.json()) as TranslateResponse | RequestError
      if (!res.ok || "error" in data) {
        setError(data as RequestError)
        return
      }
      if (data.ambiguous) {
        setAmbiguityNote(data.ambiguityNote ?? "Query is ambiguous — please clarify.")
        return
      }
      setDraft(
        filtersToDraft(
          data.filters ?? {},
          data.icpIndustries ?? [],
          data.nicheKeyword ?? "",
        ),
      )
      setDraftReasoning(data.reasoning ?? "")
    } catch (err) {
      setError({ error: err instanceof Error ? err.message : "Network error" })
    } finally {
      setIsTranslating(false)
    }
  }

  // ── Preset: load a ready-made archetype draft (no credits) ──
  const handlePreset = (presetKey: string) => {
    const preset = ARCHETYPE_PRESETS.find((p) => p.key === presetKey)
    if (!preset) return
    resetDownstreamState()
    setAmbiguityNote(null)
    setPrompt("")
    // Deep-clone so edits don't mutate the shared preset constant.
    setDraft(JSON.parse(JSON.stringify(preset.draft)) as ProspectDraft)
    setDraftReasoning(`Loaded the “${preset.label}” preset — edit the filters, then search.`)
  }

  // ── Phase 2: search Apollo with the (edited) draft (credits) ──
  const handleRunSearch = async () => {
    if (!draft || isSearching) return
    setIsSearching(true)
    setResult(null)
    setCandidates([])
    setRevealingIds(new Set())
    setSelectedIds(new Set())
    setApprovalToast(null)
    setError(null)
    try {
      const res = await fetch("/api/admin/prospecting/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: draftToFilters(draft),
          prompt: prompt.trim() || undefined,
          perPage: PER_PAGE,
        }),
      })
      const data = (await res.json()) as SearchSuccess | RequestError
      if (!res.ok || "error" in data) {
        setError(data as RequestError)
        return
      }
      setResult(data as SearchSuccess)
      setCandidates((data as SearchSuccess).candidates ?? [])
    } catch (err) {
      setError({ error: err instanceof Error ? err.message : "Network error" })
    } finally {
      setIsSearching(false)
      void loadBudget()
    }
  }

  // ── Per-row reveal: enrich one candidate (1 credit), re-score, swap in ──
  const handleReveal = async (personId: string) => {
    if (!result || revealingIds.has(personId)) return
    setRevealingIds((prev) => new Set(prev).add(personId))
    try {
      const res = await fetch("/api/admin/prospecting/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, filters: result.filters ?? {} }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setApprovalToast({ message: data?.error || "Reveal failed — see console", type: "error" })
        return
      }
      if (!data.revealed) {
        setApprovalToast({ message: "Apollo had no match — nothing to reveal (no credit charged).", type: "error" })
        return
      }
      setCandidates((prev) =>
        prev.map((c) => (c.person.id === personId ? (data.candidate as ScoredPerson) : c)),
      )
    } catch (err) {
      setApprovalToast({ message: err instanceof Error ? err.message : "Network error", type: "error" })
    } finally {
      setRevealingIds((prev) => {
        const next = new Set(prev)
        next.delete(personId)
        return next
      })
      void loadBudget()
    }
  }

  const clearDraft = () => {
    setDraft(null)
    setDraftReasoning("")
    resetDownstreamState()
  }

  const toggleSelected = (personId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const handleApprove = async () => {
    if (!result || isApproving) return
    // Use the live candidates state so any rows already revealed carry their
    // enriched email/data into approval (approve then skips re-revealing them).
    const toApprove = candidates.filter(
      (c) => selectedIds.has(c.person.id) && c.score >= 0,
    )
    if (toApprove.length === 0) return
    const ok = confirm(
      `Approve ${toApprove.length} prospect${toApprove.length === 1 ? "" : "s"} as leads?\n\nThis reveals each contact's work email (1 Apollo credit each) and adds them to /admin/leads with source "prospected". Existing leads (matched by email) are updated, not duplicated; contacts Apollo has no email for are skipped.`,
    )
    if (!ok) return

    setIsApproving(true)
    setApprovalToast(null)
    try {
      const res = await fetch("/api/admin/prospecting/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: result.prompt || "(manual filters)", candidates: toApprove }),
      })
      const data = (await res.json()) as ApprovalResponse | { error: string }
      if (!res.ok || !("success" in data)) {
        setApprovalToast({
          message: ("error" in data && data.error) || "Approval failed — see console",
          type: "error",
        })
        return
      }
      const { created, updated, skipped, failed } = data
      const parts: string[] = []
      if (created > 0) parts.push(`${created} new lead${created === 1 ? "" : "s"}`)
      if (updated > 0) parts.push(`${updated} updated`)
      if (skipped > 0) parts.push(`${skipped} skipped`)
      if (failed > 0) parts.push(`${failed} failed`)
      void loadBudget()
      setApprovalToast({
        message: `Approved: ${parts.join(", ") || "no changes"}.`,
        type: failed > 0 ? "error" : "success",
      })
      if (created + updated > 0) setSelectedIds(new Set())
    } catch (err) {
      setApprovalToast({
        message: err instanceof Error ? err.message : "Network error",
        type: "error",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const threshold = result?.threshold ?? 60
  const aboveThreshold = candidates.filter((c) => c.score >= threshold)
  const belowThreshold = candidates.filter((c) => c.score >= 0 && c.score < threshold)
  const excluded = candidates.filter((c) => c.score === -1)
  const selectableCount = candidates.filter((c) => c.score >= 0).length
  const selectedCount = selectedIds.size

  const budgetBlocked = budget !== null && budget.remaining <= 0

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <LeadsTabs active="prospect" right={budget ? <BudgetIndicator budget={budget} /> : undefined} />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          <HowItWorks
            storageKey="prospectIntroDismissed"
            steps={[
              { title: "Describe or pick a preset", detail: "Write who you're looking for in plain language, or load one of the four buyer archetypes." },
              { title: "Review & edit the filters", detail: "Tune the derived Apollo filters — titles, industries, size, hiring signals — before spending any credits." },
              { title: "Search, then approve into Leads", detail: "Search Apollo, then approve the good fits into your Leads queue as “prospected.”" },
            ]}
          />

          {/* Step 1 — describe */}
          <section className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 shadow-sm">
            <label
              htmlFor="prospect-prompt"
              className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2"
            >
              Describe who you&apos;re looking for
            </label>
            <textarea
              id="prospect-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault()
                  handleTranslate()
                }
              }}
              disabled={isTranslating}
              rows={3}
              placeholder="e.g. Biotech founders in Texas with $20M+ revenue"
              className="w-full px-3 py-2 border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 text-[13px] text-neutral-800 leading-relaxed resize-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-[11px] text-neutral-400 hidden sm:block">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-100 border border-neutral-200 rounded">⌘</kbd>{" "}
                <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-100 border border-neutral-200 rounded">Enter</kbd>{" "}
                to build filters · no credits used yet
              </span>
              <button
                onClick={handleTranslate}
                disabled={!prompt.trim() || isTranslating}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                )}
                {isTranslating ? "Building…" : "Build filters"}
              </button>
            </div>

            {/* Archetype presets */}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <Users className="w-3 h-3" />
                Or start from an archetype
              </div>
              <div className="flex flex-wrap gap-2">
                {ARCHETYPE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePreset(p.key)}
                    title={p.description}
                    className="px-3 py-1.5 text-[12px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-neutral-400 hover:bg-white transition-colors text-left"
                  >
                    <span className="font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Example prompts (only before a draft/result exists) */}
          {!draft && !result && !ambiguityNote && !isTranslating && (
            <section>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <Lightbulb className="w-3 h-3" />
                Try one of these — specific WHO + WHEN prompts
              </div>
              <div className="flex flex-col gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.prompt}
                    onClick={() => setPrompt(ex.prompt)}
                    title={`Best-practice pattern: ${ex.pattern}`}
                    className="group text-left px-3 py-2 bg-white border border-neutral-200 rounded-lg hover:border-neutral-400 transition-colors"
                  >
                    <span className="block text-[12px] text-neutral-700 group-hover:text-neutral-900 leading-snug">
                      {ex.prompt}
                    </span>
                    <span className="block text-[10px] text-neutral-400 mt-0.5">{ex.pattern}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isTranslating && (
            <section className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
              <p className="text-[13px] text-neutral-500">Translating your prompt into filters…</p>
            </section>
          )}

          {error && (
            <section className="bg-red-50 border border-red-200 rounded-xl p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-red-800">{error.error}</p>
                  {error.source && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Source: {error.source}
                      {error.code && <> · {error.code}</>}
                    </p>
                  )}
                  {error.code === "plan-blocked" && (
                    <p className="text-[12px] text-red-700 mt-2 leading-relaxed">
                      The Apollo Free plan blocks this endpoint. Upgrade to Basic at{" "}
                      <a href="https://app.apollo.io/#/settings/plans" target="_blank" rel="noopener noreferrer" className="underline">
                        Apollo plan settings
                      </a>.
                    </p>
                  )}
                  {error.code === "budget-exceeded" && (
                    <p className="text-[12px] text-red-700 mt-2 leading-relaxed">
                      Hit the local budget cap (<code className="bg-red-100 px-1 rounded">APOLLO_DAILY_CAP</code>
                      {" / "}<code className="bg-red-100 px-1 rounded">APOLLO_MONTHLY_CAP</code>).
                      Wait for reset, raise the cap in env, or upgrade your Apollo plan.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {ambiguityNote && (
            <section className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[13px] font-semibold text-amber-900">Ambiguous query — clarify and try again</p>
                  <p className="text-[12px] text-amber-800 leading-relaxed">{ambiguityNote}</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed pt-1">
                    No Apollo credits were used. Edit your prompt and build filters again.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Step 2 — editable filter panel */}
          {draft && (
            <FilterEditor
              draft={draft}
              reasoning={draftReasoning}
              onChange={setDraft}
              onSearch={handleRunSearch}
              onClear={clearDraft}
              isSearching={isSearching}
              budgetBlocked={budgetBlocked}
            />
          )}

          {/* Results */}
          {result && !result.ambiguous && (
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-neutral-900">
                    {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
                  </h2>
                  <p className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                    {aboveThreshold.length} above threshold ({threshold}+) · {belowThreshold.length} below · {excluded.length} excluded
                  </p>
                </div>
                {selectedCount > 0 && (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {isApproving ? "Approving…" : `Approve ${selectedCount} as lead${selectedCount === 1 ? "" : "s"}`}
                  </button>
                )}
              </div>

              {approvalToast && (
                <div
                  role="status"
                  className={`mb-3 flex items-start gap-2 px-3 py-2 rounded-md text-[12px] font-medium ${
                    approvalToast.type === "success"
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  {approvalToast.type === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  )}
                  <span className="flex-1 leading-relaxed">{approvalToast.message}</span>
                  {approvalToast.type === "success" && (
                    <Link href="/admin/leads" className="text-[11px] font-medium underline shrink-0">
                      View leads
                    </Link>
                  )}
                </div>
              )}

              {candidates.length > 0 && selectableCount === 0 && (
                <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50/60 border border-amber-200/70 text-[12px] text-amber-800 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <span>
                    None of these candidates can be approved — every result was excluded by ICP policy
                    (competitor agency, or an EU/Canada jurisdiction we don&apos;t cold-outreach). Try a different
                    prompt or geography.
                  </span>
                </div>
              )}

              {selectableCount > 0 && (
                <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-md bg-neutral-50 border border-neutral-200 text-[12px] text-neutral-600 leading-relaxed">
                  <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />
                  <span>
                    Apollo masks search results. Hit <strong>Reveal (1 credit)</strong> on a row to unmask its name,
                    email &amp; firmographics and re-score it — or just approve, which reveals any not-yet-revealed
                    contacts as it captures. Either way it&apos;s ~1 credit per contact, charged once.
                  </span>
                </div>
              )}

              {candidates.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <Search className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-neutral-700">No candidates returned</p>
                  <p className="text-[12px] text-neutral-500 mt-1">
                    Apollo AND-s every filter, so a narrow one zeroes the search. Most often it&apos;s the{" "}
                    <strong>Niche keyword</strong> — clear it, or widen locations/titles, then search again.
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">No credits are spent on a 0-result search.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
                  {candidates.map((c, i) => (
                    <CandidateRow
                      key={c.person.id || i}
                      candidate={c}
                      threshold={threshold}
                      selected={selectedIds.has(c.person.id)}
                      onToggleSelect={() => toggleSelected(c.person.id)}
                      onReveal={() => handleReveal(c.person.id)}
                      isRevealing={revealingIds.has(c.person.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}

// ─── Filter editor (Step 18) ───

function FilterEditor({
  draft,
  reasoning,
  onChange,
  onSearch,
  onClear,
  isSearching,
  budgetBlocked,
}: {
  draft: ProspectDraft
  reasoning: string
  onChange: (d: ProspectDraft) => void
  onSearch: () => void
  onClear: () => void
  isSearching: boolean
  budgetBlocked: boolean
}) {
  const set = (partial: Partial<ProspectDraft>) => onChange({ ...draft, ...partial })

  const numOrUndef = (v: string): number | undefined => {
    const n = Number(v.replace(/[^0-9.]/g, ""))
    return v.trim() === "" || Number.isNaN(n) ? undefined : n
  }

  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
          <SlidersHorizontal className="w-3 h-3" />
          Review &amp; edit filters
        </div>
        <button onClick={onClear} className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors">
          Clear
        </button>
      </div>

      {reasoning && (
        <p className="text-[12px] text-neutral-600 leading-relaxed bg-neutral-50 border border-neutral-100 rounded-md px-3 py-2">
          {reasoning}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChipListInput
          label="Locations"
          values={draft.organization_locations ?? []}
          onChange={(v) => set({ organization_locations: v.length ? v : undefined })}
          placeholder="e.g. Texas, US"
        />
        <ChipListInput
          label="Job titles"
          values={draft.person_titles ?? []}
          onChange={(v) => set({ person_titles: v.length ? v : undefined })}
          placeholder="e.g. Head of Partnerships"
        />
      </div>

      <MultiSelectChips
        label="Seniority"
        options={SENIORITY_OPTIONS}
        selected={draft.person_seniorities ?? []}
        onChange={(v) =>
          set({ person_seniorities: v.length ? (v as ApolloSeniority[]) : undefined })
        }
      />

      <MultiSelectChips
        label="Industries (ICP categories)"
        options={INDUSTRY_OPTIONS}
        selected={draft.icp_industries ?? []}
        onChange={(v) => set({ icp_industries: v.length ? (v as IcpIndustry[]) : undefined })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChipListInput
          label="Employee ranges (min,max)"
          values={draft.num_employees_ranges ?? []}
          onChange={(v) => set({ num_employees_ranges: v.length ? v : undefined })}
          placeholder="e.g. 51,1000"
        />
        <div>
          <FieldLabel>Annual revenue (USD)</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={draft.revenue_range?.min ?? ""}
              onChange={(e) => {
                const min = numOrUndef(e.target.value)
                const max = draft.revenue_range?.max
                set({ revenue_range: min === undefined && max === undefined ? undefined : { min, max } })
              }}
              placeholder="min"
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-md text-[12px] tabular-nums focus:outline-none focus:border-neutral-400"
            />
            <span className="text-neutral-300 text-[12px]">–</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.revenue_range?.max ?? ""}
              onChange={(e) => {
                const max = numOrUndef(e.target.value)
                const min = draft.revenue_range?.min
                set({ revenue_range: min === undefined && max === undefined ? undefined : { min, max } })
              }}
              placeholder="max"
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-md text-[12px] tabular-nums focus:outline-none focus:border-neutral-400"
            />
          </div>
        </div>
      </div>

      {/* Hiring signal (WHEN axis) */}
      <div className="pt-1 border-t border-neutral-100">
        <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-3 mb-2">
          Hiring signal — buying-moment proxy (optional)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChipListInput
            label="Hiring for roles"
            values={draft.organization_job_titles ?? []}
            onChange={(v) => set({ organization_job_titles: v.length ? v : undefined })}
            placeholder="e.g. Head of Partnerships"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Min open roles</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={draft.num_jobs_range?.min ?? ""}
                onChange={(e) => {
                  const min = numOrUndef(e.target.value)
                  set({ num_jobs_range: min === undefined ? undefined : { min } })
                }}
                placeholder="e.g. 1"
                className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-md text-[12px] tabular-nums focus:outline-none focus:border-neutral-400"
              />
            </div>
            <div>
              <FieldLabel>Posted since</FieldLabel>
              <input
                type="date"
                value={draft.job_posted_at_range?.min ?? ""}
                onChange={(e) =>
                  set({ job_posted_at_range: e.target.value ? { min: e.target.value } : undefined })
                }
                className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-md text-[12px] focus:outline-none focus:border-neutral-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Niche keyword (non-industry)</FieldLabel>
          <input
            type="text"
            value={draft.q_keywords ?? ""}
            onChange={(e) => set({ q_keywords: e.target.value || undefined })}
            placeholder="e.g. fight gear, prosthetics"
            className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-md text-[12px] focus:outline-none focus:border-neutral-400"
          />
        </div>
        <MultiSelectChips
          label="Email status"
          options={EMAIL_STATUS_OPTIONS}
          selected={draft.contact_email_status ?? []}
          onChange={(v) =>
            set({ contact_email_status: v.length ? (v as ApolloEmailStatus[]) : undefined })
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-100">
        <span className="text-[11px] text-neutral-400">
          Searching spends ~{PER_PAGE} Apollo credits (1 per result).
        </span>
        <button
          onClick={onSearch}
          disabled={isSearching || budgetBlocked}
          title={budgetBlocked ? "Apollo budget reached — wait for reset or upgrade your plan" : undefined}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {isSearching ? "Searching…" : `Search Apollo (~${PER_PAGE} credits)`}
        </button>
      </div>
    </section>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
      {children}
    </div>
  )
}

function ChipListInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState("")
  const add = () => {
    const v = input.trim()
    if (!v) return
    if (!values.includes(v)) onChange([...values, v])
    setInput("")
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-neutral-200 rounded-md min-h-9.5 focus-within:border-neutral-400">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-neutral-700 bg-neutral-100"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label={`Remove ${v}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            } else if (e.key === "Backspace" && !input && values.length) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={add}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-20 text-[12px] text-neutral-800 focus:outline-none bg-transparent"
        />
      </div>
    </div>
  )
}

function MultiSelectChips<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (v: T[]) => void
}) {
  const toggle = (val: T) =>
    selected.includes(val) ? onChange(selected.filter((v) => v !== val)) : onChange([...selected, val])
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.value)
          return (
            <button
              key={o.value}
              onClick={() => toggle(o.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                active
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Budget indicator ───

function BudgetIndicator({ budget }: { budget: BudgetStatus }) {
  const monthlyPct = budget.monthlyCap > 0 ? budget.monthlyRemaining / budget.monthlyCap : 0
  const tone =
    monthlyPct <= 0.05 ? "text-red-600" : monthlyPct <= 0.25 ? "text-amber-600" : "text-neutral-500"
  return (
    <div className="flex items-center gap-2 text-[11px] tabular-nums">
      <span className={tone}>
        <strong className="font-semibold">{budget.thisMonth}</strong>
        <span className="text-neutral-400">{" / "}</span>
        {budget.monthlyCap}
        <span className="text-neutral-400">{" credits this month"}</span>
      </span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-500">
        <strong className="font-semibold">{budget.today}</strong>
        <span className="text-neutral-400">{" / "}</span>
        {budget.dailyCap}
        <span className="text-neutral-400">{" today"}</span>
      </span>
    </div>
  )
}

// ─── Candidate row ───

function CandidateRow({
  candidate,
  threshold,
  selected,
  onToggleSelect,
  onReveal,
  isRevealing,
}: {
  candidate: ScoredPerson
  threshold: number
  selected: boolean
  onToggleSelect: () => void
  onReveal: () => void
  isRevealing: boolean
}) {
  const { person, score, grade, breakdown, contactQualifier, reasons, excluded } = candidate
  const isExcluded = score === -1
  const aboveThreshold = !isExcluded && score >= threshold
  const isApprovable = !isExcluded
  const checkboxDisabledReason = isExcluded ? "Excluded by ICP filter — not approvable" : undefined

  const scoreTint = isExcluded
    ? "bg-red-100 text-red-700 border-red-200"
    : aboveThreshold
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-amber-100 text-amber-800 border-amber-200"

  const rowOpacity = isExcluded ? "opacity-50" : aboveThreshold ? "" : "opacity-75"

  const lastName = person.last_name || person.last_name_obfuscated || ""
  const displayName = `${person.first_name} ${lastName}`.trim() || "(unnamed)"

  return (
    <div className={`px-4 py-3.5 hover:bg-neutral-50/50 transition-colors ${rowOpacity}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!isApprovable}
          onChange={onToggleSelect}
          className="rounded border-neutral-300 mt-4 shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
          title={checkboxDisabledReason ?? "Select for approval"}
          aria-label={`Select ${displayName} for approval`}
        />
        <div className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-md border tabular-nums ${scoreTint}`}>
          {isExcluded ? (
            <Ban className="w-5 h-5" />
          ) : (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[15px] font-bold">{score}</span>
              <span className="text-[9px] font-semibold opacity-70">{grade}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-neutral-900 leading-tight">{displayName}</p>
            {person.last_name_obfuscated && !person.last_name && (
              <span className="text-[10px] text-neutral-400" title="Last name hidden — revealed on approve">
                hidden
              </span>
            )}
            {aboveThreshold && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-neutral-600 mt-0.5">
            {person.title && <span>{person.title}</span>}
            {person.title && person.organization?.name && <span className="text-neutral-300">·</span>}
            {person.organization?.name && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3 text-neutral-400" />
                {person.organization.name}
              </span>
            )}
          </div>
          {/* Render for any non-excluded candidate so the Reveal button shows
              even when Apollo's masked search returns no email/linkedin/status. */}
          {(!isExcluded || person.email || person.linkedin_url) && (
            <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1">
              {person.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {person.email}
                </span>
              ) : (
                !isExcluded && (
                  <button
                    onClick={onReveal}
                    disabled={isRevealing}
                    title="Spend 1 Apollo credit to reveal this contact's name, email & firmographics, then re-score"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRevealing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    {isRevealing ? "Revealing…" : "Reveal (1 credit)"}
                    {!isRevealing && person.email_status === "verified" && (
                      <span className="text-emerald-600"> · verified</span>
                    )}
                  </button>
                )
              )}
              {person.linkedin_url && (
                <a
                  href={person.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <LinkedinIcon className="w-3 h-3" />
                  LinkedIn
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
              )}
            </div>
          )}

          {isExcluded ? (
            <p className="text-[11px] text-red-700 mt-2 leading-relaxed">{excluded}</p>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-neutral-500 tabular-nums">
              <span>Industry <strong className="text-neutral-700">+{breakdown.industry}</strong></span>
              <span>Location <strong className="text-neutral-700">+{breakdown.location}</strong></span>
              <span>Size <strong className="text-neutral-700">+{breakdown.companySize}</strong></span>
              {breakdown.fundingStage !== undefined && (
                <span>Funding <strong className="text-neutral-700">+{breakdown.fundingStage}</strong></span>
              )}
              <span className="text-neutral-400" title="Contact seniority — a qualifier, not part of company fit">
                Contact <strong className="text-neutral-600">+{contactQualifier}</strong>
              </span>
            </div>
          )}

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

"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  Archive, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw, 
  Building2,
  Calendar,
  DollarSign,
  User,
  Filter,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { formatCurrency, formatDate, BRAND_GOALS, TEAM_MEMBERS } from "./types"
import type { Client, Brand, Disposition } from "./types"

interface ArchivedOpportunitiesSectionProps {
  archivedOpportunities: Client[]
  onRestoreOpportunity: (clientId: string) => void
  onOpportunityClick?: (client: Client) => void
  currentUserName?: string  // Default assignee filter to logged-in user
}

export function ArchivedOpportunitiesSection({
  archivedOpportunities,
  onRestoreOpportunity,
  onOpportunityClick,
  currentUserName
}: ArchivedOpportunitiesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all")
  // Default to current user if provided, otherwise show all
  const [assigneeFilter, setAssigneeFilter] = useState<string>(currentUserName || "all")

  // Get unique years from archived opportunities
  const uniqueYears = useMemo(() => {
    const years = new Set<string>()
    archivedOpportunities.forEach(opp => {
      if (opp.archived_at) {
        years.add(new Date(opp.archived_at).getFullYear().toString())
      } else if (opp.updated_at) {
        years.add(new Date(opp.updated_at).getFullYear().toString())
      }
    })
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a))
  }, [archivedOpportunities])

  // Get all team members for the assignee filter dropdown
  const allTeamMembers = useMemo(() => {
    return TEAM_MEMBERS.map(m => m.name).sort()
  }, [])

  // Filter archived opportunities
  const filteredOpportunities = useMemo(() => {
    return archivedOpportunities.filter(opp => {
      // Year filter
      if (yearFilter !== "all") {
        const oppYear = opp.archived_at 
          ? new Date(opp.archived_at).getFullYear().toString()
          : opp.updated_at 
            ? new Date(opp.updated_at).getFullYear().toString()
            : null
        if (oppYear !== yearFilter) return false
      }

      // Brand filter
      if (brandFilter !== "all" && opp.brand !== brandFilter) {
        return false
      }

      // Outcome filter
      if (outcomeFilter !== "all" && opp.disposition !== outcomeFilter) {
        return false
      }

      // Assignee filter
      if (assigneeFilter !== "all" && opp.assigned_to !== assigneeFilter) {
        return false
      }

      return true
    })
  }, [archivedOpportunities, yearFilter, brandFilter, outcomeFilter, assigneeFilter])

  // Calculate summary stats
  const wonCount = archivedOpportunities.filter(o => o.disposition === "closed_won").length
  const lostCount = archivedOpportunities.filter(o => o.disposition === "closed_lost").length
  const wonRevenue = archivedOpportunities
    .filter(o => o.disposition === "closed_won")
    .reduce((sum, o) => sum + (o.pitch_value || 0), 0)
  const lostRevenue = archivedOpportunities
    .filter(o => o.disposition === "closed_lost")
    .reduce((sum, o) => sum + (o.pitch_value || 0), 0)

  if (archivedOpportunities.length === 0) {
    return null
  }

  return (
    <div className="mt-8 bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Archive className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-neutral-900">Archived Opportunities</h3>
            <p className="text-xs text-neutral-500 tabular-nums">
              {archivedOpportunities.length} archived · {formatCurrency(wonRevenue, true)} won · {formatCurrency(lostRevenue, true)} lost
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick stats — mono pills with colored dots */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-700 tabular-nums">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {wonCount} Won
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-700 tabular-nums">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-500" aria-hidden="true" />
              {lostCount} Lost
            </span>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-md text-neutral-500">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-100"
          >
            {/* Scroll container — list scrolls inside, filter bar stays put */}
            <div className="max-h-[60dvh] sm:max-h-120 overflow-y-auto">
              {/* Filters — sticky inside the scroll container so they stay visible while the list scrolls */}
              <div className="sticky top-0 z-10 p-4 bg-white/85 backdrop-blur-md border-b border-neutral-100">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filters</span>
                  </div>

                  {/* Year Filter */}
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400"
                    aria-label="Filter by year"
                  >
                    <option value="all">All years</option>
                    {uniqueYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>

                  {/* Brand Filter */}
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400"
                    aria-label="Filter by brand"
                  >
                    <option value="all">All brands</option>
                    {BRAND_GOALS.map(goal => (
                      <option key={goal.brand} value={goal.brand}>{goal.brand}</option>
                    ))}
                  </select>

                  {/* Outcome Filter */}
                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400"
                    aria-label="Filter by outcome"
                  >
                    <option value="all">All outcomes</option>
                    <option value="closed_won">Won</option>
                    <option value="closed_lost">Lost</option>
                  </select>

                  {/* Assignee Filter */}
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400"
                    aria-label="Filter by assignee"
                  >
                    <option value="all">All assignees</option>
                    {allTeamMembers.map(assignee => (
                      <option key={assignee} value={assignee}>{assignee}</option>
                    ))}
                  </select>

                  {/* Results count */}
                  <span className="text-xs tabular-nums text-neutral-500 ml-auto">
                    Showing {filteredOpportunities.length} of {archivedOpportunities.length}
                  </span>
                </div>
              </div>

              {/* Archived Opportunities List */}
              {filteredOpportunities.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-500 mx-auto mb-3">
                    <Archive className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-neutral-500">No archived opportunities match your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {filteredOpportunities.map((opportunity) => (
                    <div
                      key={opportunity.id}
                      className="p-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Left side - Opportunity info */}
                        <button
                          onClick={() => onOpportunityClick?.(opportunity)}
                          className="flex-1 text-left group min-w-0"
                        >
                          <div className="flex items-center gap-3">
                            {/* Outcome indicator — kept tinted because it encodes semantic finality (Won vs Lost) */}
                            <div className={`grid h-7 w-7 place-items-center rounded-md shrink-0 ${
                              opportunity.disposition === "closed_won"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-neutral-100 text-neutral-500"
                            }`}>
                              {opportunity.disposition === "closed_won" ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Title */}
                              <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-neutral-950 transition-colors">
                                {opportunity.title || opportunity.company_name || opportunity.name}
                              </p>

                              {/* Company name (if title exists) */}
                              {opportunity.title && (
                                <p className="text-xs text-neutral-500 truncate flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3" />
                                  {opportunity.company_name || opportunity.name}
                                </p>
                              )}

                              {/* Meta info */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                {opportunity.brand && (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                                    <span
                                      className="inline-block h-1 w-1 rounded-full"
                                      style={{
                                        backgroundColor: BRAND_GOALS.find(g => g.brand === opportunity.brand)?.color || "#737373",
                                      }}
                                      aria-hidden="true"
                                    />
                                    {opportunity.brand}
                                  </span>
                                )}
                                {opportunity.pitch_value && opportunity.pitch_value > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-neutral-700">
                                    <DollarSign className="w-3 h-3 text-neutral-400" />
                                    {formatCurrency(opportunity.pitch_value, true)}
                                  </span>
                                )}
                                {opportunity.assigned_to && (
                                  <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                                    <User className="w-3 h-3" />
                                    {opportunity.assigned_to}
                                  </span>
                                )}
                                {opportunity.archived_at && (
                                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-neutral-400">
                                    <Calendar className="w-3 h-3" />
                                    Archived {formatDate(opportunity.archived_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Right side - Restore button: full label on every breakpoint, ≥36px touch target, aria-label for SR */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRestoreOpportunity(opportunity.id)
                          }}
                          aria-label={`Restore ${opportunity.title || opportunity.company_name || opportunity.name} to active kanban`}
                          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-neutral-700 ring-1 ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-100 rounded-md transition-colors shrink-0"
                          title="Restore to active kanban"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-neutral-100">
              <p className="text-[11px] text-neutral-500 text-center">
                Opportunities are auto-archived 60 days after closing. Click <span className="font-medium text-neutral-700">Restore</span> to move them back to the active kanban.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

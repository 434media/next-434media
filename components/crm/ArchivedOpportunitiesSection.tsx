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
    <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center">
            <Archive className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">Archived Opportunities</h3>
            <p className="text-sm text-gray-500">
              {archivedOpportunities.length} archived • {formatCurrency(wonRevenue, true)} won • {formatCurrency(lostRevenue, true)} lost
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick stats badges */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              {wonCount} Won
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
              <XCircle className="w-3 h-3" />
              {lostCount} Lost
            </span>
          </div>
          <div className="p-2 rounded-lg bg-gray-100">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
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
            className="overflow-hidden border-t border-gray-200"
          >
            {/* Filters */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Filter className="w-4 h-4" />
                  <span>Filters:</span>
                </div>
                
                {/* Year Filter */}
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
                >
                  <option value="all">All Years</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                {/* Brand Filter */}
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
                >
                  <option value="all">All Brands</option>
                  {BRAND_GOALS.map(goal => (
                    <option key={goal.brand} value={goal.brand}>{goal.brand}</option>
                  ))}
                </select>

                {/* Outcome Filter */}
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
                >
                  <option value="all">All Outcomes</option>
                  <option value="closed_won">Won</option>
                  <option value="closed_lost">Lost</option>
                </select>

                {/* Assignee Filter */}
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
                >
                  <option value="all">All Assignees</option>
                  {allTeamMembers.map(assignee => (
                    <option key={assignee} value={assignee}>{assignee}</option>
                  ))}
                </select>

                {/* Results count */}
                <span className="text-sm text-gray-500 ml-auto">
                  Showing {filteredOpportunities.length} of {archivedOpportunities.length}
                </span>
              </div>
            </div>

            {/* Archived Opportunities List */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredOpportunities.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Archive className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No archived opportunities match your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredOpportunities.map((opportunity) => (
                    <div
                      key={opportunity.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left side - Opportunity info */}
                        <button
                          onClick={() => onOpportunityClick?.(opportunity)}
                          className="flex-1 text-left group"
                        >
                          <div className="flex items-center gap-3">
                            {/* Outcome indicator */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              opportunity.disposition === "closed_won"
                                ? "bg-emerald-100"
                                : "bg-slate-100"
                            }`}>
                              {opportunity.disposition === "closed_won" ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Title */}
                              <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                {opportunity.title || opportunity.company_name || opportunity.name}
                              </p>

                              {/* Company name (if title exists) */}
                              {opportunity.title && (
                                <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {opportunity.company_name || opportunity.name}
                                </p>
                              )}

                              {/* Meta info */}
                              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                {opportunity.brand && (
                                  <span 
                                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded"
                                    style={{
                                      backgroundColor: BRAND_GOALS.find(g => g.brand === opportunity.brand)?.color + "15",
                                      color: BRAND_GOALS.find(g => g.brand === opportunity.brand)?.color
                                    }}
                                  >
                                    {opportunity.brand}
                                  </span>
                                )}
                                {opportunity.pitch_value && opportunity.pitch_value > 0 && (
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                                    opportunity.disposition === "closed_won" ? "text-emerald-600" : "text-gray-500"
                                  }`}>
                                    <DollarSign className="w-3 h-3" />
                                    {formatCurrency(opportunity.pitch_value, true)}
                                  </span>
                                )}
                                {opportunity.assigned_to && (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                    <User className="w-3 h-3" />
                                    {opportunity.assigned_to}
                                  </span>
                                )}
                                {opportunity.archived_at && (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                    <Calendar className="w-3 h-3" />
                                    Archived {formatDate(opportunity.archived_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Right side - Restore button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRestoreOpportunity(opportunity.id)
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                          title="Restore to active kanban"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">Restore</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                💡 Opportunities are auto-archived 60 days after closing. Click "Restore" to move back to active kanban.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

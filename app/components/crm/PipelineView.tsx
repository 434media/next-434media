"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { RefreshCw, ChevronDown, ChevronUp, Target, GripVertical } from "lucide-react"
import { formatCurrency, formatDate, BRAND_GOALS, BRANDS } from "./types"
import type { PipelineColumn, Opportunity, Brand, Client } from "./types"

interface PipelineViewProps {
  pipeline: PipelineColumn[]
  clients?: Client[]
  onRefresh: () => void
  onClientClick?: (client: Client) => void
  onDragEnd?: (clientId: string, newStage: string) => void
}

// Brand Goal Card component
function BrandGoalCard({ 
  brand, 
  goal, 
  color, 
  description,
  isExpanded,
  onToggle,
  clients,
  pipeline,
  onClientClick,
  onDragEnd,
}: {
  brand: Brand
  goal: number
  color: string
  description: string
  isExpanded: boolean
  onToggle: () => void
  clients: Client[]
  pipeline: PipelineColumn[]
  onClientClick?: (client: Client) => void
  onDragEnd?: (clientId: string, newStage: string) => void
}) {
  // Filter clients for this brand
  const brandClients = clients.filter(c => c.brand === brand)
  
  // Calculate stats for this brand from clients
  const wonClients = brandClients.filter(c => c.status === "active")
  const wonRevenue = wonClients.reduce((sum, c) => sum + (c.pitch_value || c.lifetime_value || 0), 0)
  const totalPitched = brandClients.reduce((sum, c) => sum + (c.pitch_value || 0), 0)
  const progressPercent = Math.min(100, (wonRevenue / goal) * 100)

  // Get pipeline stages
  const stages = [
    { id: "lead", label: "Lead", color: "#6366f1" },
    { id: "qualified", label: "Qualified", color: "#3b82f6" },
    { id: "proposal", label: "Proposal", color: "#8b5cf6" },
    { id: "negotiation", label: "Negotiation", color: "#f59e0b" },
    { id: "closed_won", label: "Closed Won", color: "#10b981" },
    { id: "closed_lost", label: "Closed Lost", color: "#ef4444" },
  ]

  // Map client status to stage
  const getClientStage = (client: Client) => {
    switch (client.status) {
      case "prospect": return "lead"
      case "active": return "closed_won"
      case "inactive": return "closed_lost"
      case "churned": return "closed_lost"
      default: return "lead"
    }
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, client: Client) => {
    e.dataTransfer.setData("clientId", client.id)
    e.dataTransfer.setData("clientBrand", client.brand || "")
  }

  // Handle drop
  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    const clientId = e.dataTransfer.getData("clientId")
    if (onDragEnd) {
      onDragEnd(clientId, stageId)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      {/* Card Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Target className="w-6 h-6" style={{ color }} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">{brand}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Goal Progress */}
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">Goal</p>
            <p className="text-xl font-bold" style={{ color }}>{formatCurrency(goal, true)}</p>
          </div>
          
          {/* Progress */}
          <div className="hidden md:flex flex-col items-end gap-1 w-32">
            <div className="flex items-center justify-between w-full text-xs">
              <span className="text-gray-500">{Math.round(progressPercent)}%</span>
              <span className="text-emerald-600 font-medium">{formatCurrency(wonRevenue, true)}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, backgroundColor: color }}
              />
            </div>
          </div>

          {/* Expand/Collapse */}
          <div className="p-2 rounded-lg bg-gray-100">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Kanban View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-gray-200"
          >
            <div className="p-4">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500">Total Clients</p>
                  <p className="text-lg font-semibold text-gray-900">{brandClients.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500">Total Pitched</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalPitched, true)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500">Won Revenue</p>
                  <p className="text-lg font-semibold text-emerald-600">{formatCurrency(wonRevenue, true)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className="text-lg font-semibold text-amber-600">{formatCurrency(Math.max(0, goal - wonRevenue), true)}</p>
                </div>
              </div>

              {/* Kanban Columns */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 overflow-x-auto pb-2">
                {stages.map((stage) => {
                  const stageClients = brandClients.filter(c => getClientStage(c) === stage.id)
                  
                  return (
                    <div 
                      key={stage.id} 
                      className="min-w-[180px]"
                      onDrop={(e) => handleDrop(e, stage.id)}
                      onDragOver={handleDragOver}
                    >
                      {/* Stage Header */}
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-gray-100">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        <span className="text-xs font-medium text-gray-700">{stage.label}</span>
                        <span className="ml-auto text-xs text-gray-500">{stageClients.length}</span>
                      </div>

                      {/* Client Cards */}
                      <div className="space-y-2 min-h-[100px]">
                        {stageClients.length === 0 ? (
                          <div className="p-3 rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400">
                            No clients
                          </div>
                        ) : (
                          stageClients.map((client) => (
                            <motion.div
                              key={client.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, client)}
                              onClick={() => onClientClick?.(client)}
                              className="p-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing group"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{client.company_name || client.name}</p>
                                  {client.pitch_value && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1">{formatCurrency(client.pitch_value, true)}</p>
                                  )}
                                  {client.next_followup_date && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Follow up: {formatDate(client.next_followup_date)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PipelineView({ pipeline, clients = [], onRefresh, onClientClick, onDragEnd }: PipelineViewProps) {
  const [expandedBrand, setExpandedBrand] = useState<Brand | null>(null)

  const handleToggleBrand = (brand: Brand) => {
    setExpandedBrand(prev => prev === brand ? null : brand)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sales Pipeline by Brand</h3>
          <p className="text-sm text-gray-500 mt-1">
            Click on a brand card to view and manage clients in a kanban-style layout. Drag clients between stages.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Brand Goal Cards */}
      <div className="space-y-4">
        {BRAND_GOALS.map((brandGoal) => (
          <BrandGoalCard
            key={brandGoal.brand}
            brand={brandGoal.brand}
            goal={brandGoal.annualGoal}
            color={brandGoal.color}
            description={brandGoal.description}
            isExpanded={expandedBrand === brandGoal.brand}
            onToggle={() => handleToggleBrand(brandGoal.brand)}
            clients={clients}
            pipeline={pipeline}
            onClientClick={onClientClick}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>

      {/* Traditional Pipeline Legend */}
      <div className="mt-8">
        <h4 className="text-sm font-semibold mb-3 text-gray-500">Pipeline Stages Reference</h4>
        <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span>Lead</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Qualified</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span>Proposal</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Negotiation</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Closed Won</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Closed Lost</span>
          </div>
        </div>
      </div>
    </div>
  )
}

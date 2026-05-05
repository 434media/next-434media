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

  // Get pipeline stages - cohesive color palette
  const stages = [
    { id: "lead", label: "Lead", color: "#3b82f6" },           // Blue
    { id: "qualified", label: "Qualified", color: "#06b6d4" },  // Cyan
    { id: "proposal", label: "Proposal", color: "#0ea5e9" },    // Sky blue
    { id: "negotiation", label: "Negotiation", color: "#f59e0b" }, // Amber
    { id: "closed_won", label: "Closed Won", color: "#22c55e" },   // Green
    { id: "closed_lost", label: "Closed Lost", color: "#64748b" }, // Slate
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
    <div className="rounded-md ring-1 ring-neutral-200/70 overflow-hidden bg-white">
      {/* Card Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Target className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="inline-flex items-center gap-1.5 text-base font-medium text-neutral-900">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {brand}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Goal Progress */}
          <div className="text-right hidden sm:block">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Goal</p>
            <p className="text-base font-semibold tabular-nums text-neutral-900">{formatCurrency(goal, true)}</p>
          </div>

          {/* Progress */}
          <div className="hidden md:flex flex-col items-end gap-1 w-32">
            <div className="flex items-center justify-between w-full text-xs">
              <span className="text-neutral-500 tabular-nums">{Math.round(progressPercent)}%</span>
              <span className="text-neutral-900 font-medium tabular-nums">{formatCurrency(wonRevenue, true)}</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-neutral-900 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Expand/Collapse */}
          <div className="grid h-9 w-9 place-items-center rounded-md text-neutral-500">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
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
            className="overflow-hidden border-t border-neutral-100"
          >
            <div className="p-4">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-md ring-1 ring-neutral-200/70">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Total Clients</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{brandClients.length}</p>
                </div>
                <div className="p-3 rounded-md ring-1 ring-neutral-200/70">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Total Pitched</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatCurrency(totalPitched, true)}</p>
                </div>
                <div className="p-3 rounded-md ring-1 ring-neutral-200/70">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Won Revenue</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatCurrency(wonRevenue, true)}</p>
                </div>
                <div className="p-3 rounded-md ring-1 ring-neutral-200/70">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Remaining</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatCurrency(Math.max(0, goal - wonRevenue), true)}</p>
                </div>
              </div>

              {/* Kanban Columns */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 overflow-x-auto pb-2">
                {stages.map((stage) => {
                  const stageClients = brandClients.filter(c => getClientStage(c) === stage.id)

                  return (
                    <DropColumn
                      key={stage.id}
                      stage={stage}
                      stageClients={stageClients}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      handleDragStart={handleDragStart}
                      onClientClick={onClientClick}
                    />
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

// Single drop-target column. Lifted out so we can hold local dragOver state for drop-indicator.
function DropColumn({
  stage,
  stageClients,
  onDrop,
  onDragOver,
  handleDragStart,
  onClientClick,
}: {
  stage: { id: string; label: string; color: string }
  stageClients: Client[]
  onDrop: (e: React.DragEvent, stageId: string) => void
  onDragOver: (e: React.DragEvent) => void
  handleDragStart: (e: React.DragEvent, client: Client) => void
  onClientClick?: (client: Client) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      className={`min-w-45 rounded-md transition-colors ${
        isDragOver ? "ring-2 ring-neutral-900 ring-offset-2" : ""
      }`}
      onDrop={(e) => {
        setIsDragOver(false)
        onDrop(e, stage.id)
      }}
      onDragOver={(e) => {
        setIsDragOver(true)
        onDragOver(e)
      }}
      onDragLeave={() => setIsDragOver(false)}
    >
      {/* Stage Header — flat strip, dot + label · count */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color }}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-neutral-900 truncate">{stage.label}</span>
        <span className="ml-auto text-xs tabular-nums text-neutral-500">({stageClients.length})</span>
      </div>

      {/* Client Cards */}
      <div className="space-y-2 min-h-25">
        {stageClients.length === 0 ? (
          <div className="p-3 rounded-md border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
            {isDragOver ? "Release to drop" : "No clients"}
          </div>
        ) : (
          stageClients.map((client) => (
            <motion.div
              key={client.id}
              draggable
              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, client)}
              onClick={() => onClientClick?.(client)}
              className="p-3 rounded-md bg-white ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,outline-color] cursor-grab active:cursor-grabbing group"
            >
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{client.company_name || client.name}</p>
                  {client.pitch_value && (
                    <p className="text-xs text-neutral-900 font-medium tabular-nums mt-1">{formatCurrency(client.pitch_value, true)}</p>
                  )}
                  {client.next_followup_date && (
                    <p className="text-xs text-neutral-500 tabular-nums mt-1">
                      Follow up · {formatDate(client.next_followup_date)}
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
          <h3 className="text-lg font-medium text-neutral-900">Sales Pipeline by Brand</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Click on a brand card to view and manage clients in a kanban-style layout. Drag clients between stages.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 h-9 px-3 text-sm bg-white ring-1 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300 rounded-md transition-colors self-start sm:self-auto"
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

      {/* Pipeline Stages Legend — flat reference strip */}
      <div className="mt-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">Pipeline Stages</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 p-3 rounded-md bg-white ring-1 ring-neutral-200/70">
          {[
            { color: "bg-blue-500", label: "Lead" },
            { color: "bg-cyan-500", label: "Qualified" },
            { color: "bg-sky-500", label: "Proposal" },
            { color: "bg-amber-500", label: "Negotiation" },
            { color: "bg-green-500", label: "Closed Won" },
            { color: "bg-slate-400", label: "Closed Lost" },
          ].map((stage) => (
            <div key={stage.label} className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${stage.color}`} aria-hidden="true" />
              <span>{stage.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

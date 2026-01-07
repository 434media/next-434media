"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  GripVertical, 
  Target, 
  ChevronDown, 
  ChevronUp,
  Users,
  CheckSquare,
  TrendingUp,
  Plus
} from "lucide-react"
import { 
  formatCurrency, 
  formatDate, 
  BRAND_GOALS, 
  DISPOSITION_OPTIONS,
  DOC_OPTIONS
} from "./types"
import type { 
  Client, 
  Task, 
  Disposition, 
  DOC, 
  Brand 
} from "./types"

// Type for kanban items (can be client or task)
interface KanbanItem {
  id: string
  type: "client" | "task"
  name: string
  brand?: Brand
  value?: number
  disposition?: Disposition
  doc?: DOC
  dueDate?: string
  assignedTo?: string
  status?: string
  originalData: Client | Task
}

interface OpportunitiesKanbanViewProps {
  clients: Client[]
  tasks: Task[]
  onRefresh?: () => void
  onClientClick: (client: Client) => void
  onTaskClick: (task: Task) => void
  onUpdateClientDisposition?: (clientId: string, disposition: Disposition) => void
  onUpdateTaskDisposition?: (taskId: string, disposition: Disposition) => void
  onAddOpportunity?: () => void
}

// Helper to check if a brand matches a goal (supports combined brands like 434 Media + Digital Canvas)
function matchesBrandGoal(itemBrand: Brand | undefined, goal: typeof BRAND_GOALS[0]): boolean {
  if (!itemBrand) return false
  // If goal has includedBrands, check if item's brand is in that array
  if (goal.includedBrands && goal.includedBrands.length > 0) {
    return goal.includedBrands.includes(itemBrand)
  }
  // Otherwise do exact match
  return itemBrand === goal.brand
}

// Platform Goals Summary Card
function PlatformGoalsSummary({ 
  clients, 
  tasks,
  isExpanded,
  onToggle 
}: { 
  clients: Client[]
  tasks: Task[]
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">Platform Goals & Progress</h3>
            <p className="text-sm text-gray-500">View annual targets by brand</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-6">
            {BRAND_GOALS.map((goal) => {
              const brandClients = clients.filter(c => matchesBrandGoal(c.brand, goal) && c.is_opportunity)
              const wonRevenue = brandClients
                .filter(c => c.disposition === "closed_won")
                .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
              const progress = Math.min(100, (wonRevenue / goal.annualGoal) * 100)
              
              return (
                <div key={goal.brand} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: goal.color }} 
                  />
                  <span className="text-xs font-medium text-gray-600">{Math.round(progress)}%</span>
                </div>
              )
            })}
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

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-200"
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BRAND_GOALS.map((goal) => {
                const brandClients = clients.filter(c => matchesBrandGoal(c.brand, goal) && c.is_opportunity)
                const brandTasks = tasks.filter(t => matchesBrandGoal(t.brand, goal) && t.is_opportunity)
                const totalItems = brandClients.length + brandTasks.length
                
                const wonRevenue = brandClients
                  .filter(c => c.disposition === "closed_won")
                  .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
                const pipelineValue = brandClients
                  .filter(c => c.disposition !== "closed_won" && c.disposition !== "closed_lost")
                  .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
                const progress = Math.min(100, (wonRevenue / goal.annualGoal) * 100)

                // Display name - show combined label if there are included brands
                const displayName = goal.includedBrands && goal.includedBrands.length > 1 
                  ? `${goal.brand} / ${goal.includedBrands.filter(b => b !== goal.brand).join(", ")}`
                  : goal.brand

                return (
                  <div 
                    key={goal.brand}
                    className="p-4 rounded-xl border border-gray-200 bg-gray-50/50"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${goal.color}15` }}
                      >
                        <Target className="w-4 h-4" style={{ color: goal.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-500">{totalItems} opportunities</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Goal</span>
                        <span className="font-medium text-gray-900">{formatCurrency(goal.annualGoal, true)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Won</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(wonRevenue, true)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Pipeline</span>
                        <span className="font-medium text-blue-600">{formatCurrency(pipelineValue, true)}</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-medium" style={{ color: goal.color }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progress}%`, backgroundColor: goal.color }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Individual Kanban Card
function KanbanCard({ 
  item, 
  onClick,
  onDragStart 
}: { 
  item: KanbanItem
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  const isClient = item.type === "client"
  const docLabel = item.doc ? `${item.doc}%` : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group p-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {/* Header with type badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
              isClient 
                ? "bg-blue-100 text-blue-700" 
                : "bg-purple-100 text-purple-700"
            }`}>
              {isClient ? <Users className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
              {isClient ? "Client" : "Task"}
            </span>
            {docLabel && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                DOC: {docLabel}
              </span>
            )}
          </div>

          {/* Name */}
          <p className="text-sm font-medium text-gray-900 truncate leading-snug">
            {item.name}
          </p>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-2">
            {item.value && item.value > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                {formatCurrency(item.value, true)}
              </span>
            )}
            {item.brand && (
              <span className="text-xs text-gray-500 truncate">
                {item.brand}
              </span>
            )}
          </div>

          {/* Due date or follow-up */}
          {item.dueDate && (
            <p className="text-xs text-gray-400 mt-1.5">
              {isClient ? "Follow up" : "Due"}: {formatDate(item.dueDate)}
            </p>
          )}

          {/* Assigned to */}
          {item.assignedTo && (
            <p className="text-xs text-gray-400 mt-1">
              {item.assignedTo}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Kanban Column
function KanbanColumn({ 
  disposition, 
  label, 
  color, 
  items,
  totalValue,
  onItemClick,
  onDragOver,
  onDrop 
}: { 
  disposition: Disposition
  label: string
  color: string
  items: KanbanItem[]
  totalValue: number
  onItemClick: (item: KanbanItem) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
    onDragOver(e)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    onDrop(e)
  }

  return (
    <div 
      className={`flex flex-col min-w-[300px] flex-1 rounded-xl transition-all ${
        isDragOver ? "ring-2 ring-blue-400 ring-offset-2" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div 
        className="flex items-center justify-between p-3 rounded-t-xl"
        style={{ backgroundColor: `${color}10` }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color }} 
          />
          <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
          <span className="text-xs font-medium text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs font-medium" style={{ color }}>
            {formatCurrency(totalValue, true)}
          </span>
        )}
      </div>

      {/* Cards Container */}
      <div 
        className="flex-1 p-2 space-y-2 bg-gray-50/50 rounded-b-xl border border-gray-200 border-t-0 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto"
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-xs text-gray-400">Drop items here</p>
          </div>
        ) : (
          items.map((item) => (
            <KanbanCard 
              key={`${item.type}-${item.id}`}
              item={item}
              onClick={() => onItemClick(item)}
              onDragStart={(e) => {
                e.dataTransfer.setData("itemId", item.id)
                e.dataTransfer.setData("itemType", item.type)
                e.dataTransfer.setData("currentDisposition", item.disposition || "pitched")
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function OpportunitiesKanbanView({
  clients,
  tasks,
  onRefresh,
  onClientClick,
  onTaskClick,
  onUpdateClientDisposition,
  onUpdateTaskDisposition,
  onAddOpportunity
}: OpportunitiesKanbanViewProps) {
  const [showGoals, setShowGoals] = useState(false)
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: "client" | "task" } | null>(null)

  // Filter only opportunity items
  const opportunityClients = clients.filter(c => c.is_opportunity)
  const opportunityTasks = tasks.filter(t => t.is_opportunity)

  // Convert to kanban items
  const convertToKanbanItems = useCallback((): KanbanItem[] => {
    const clientItems: KanbanItem[] = opportunityClients.map(client => ({
      id: client.id,
      type: "client" as const,
      name: client.company_name || client.name,
      brand: client.brand,
      value: client.pitch_value,
      disposition: client.disposition || "pitched",
      doc: client.doc,
      dueDate: client.next_followup_date,
      assignedTo: client.assigned_to,
      status: client.status,
      originalData: client
    }))

    const taskItems: KanbanItem[] = opportunityTasks.map(task => ({
      id: task.id,
      type: "task" as const,
      name: task.title,
      brand: task.brand,
      value: undefined,
      disposition: task.disposition || "pitched",
      doc: task.doc,
      dueDate: task.due_date,
      assignedTo: task.assigned_to,
      status: task.status,
      originalData: task
    }))

    return [...clientItems, ...taskItems]
  }, [opportunityClients, opportunityTasks])

  const allItems = convertToKanbanItems()

  // Group items by disposition
  const getItemsByDisposition = (disposition: Disposition): KanbanItem[] => {
    return allItems.filter(item => (item.disposition || "open") === disposition)
  }

  // Calculate total value for a column
  const getColumnValue = (disposition: Disposition): number => {
    return getItemsByDisposition(disposition)
      .reduce((sum, item) => sum + (item.value || 0), 0)
  }

  // Handle item click
  const handleItemClick = (item: KanbanItem) => {
    if (item.type === "client") {
      onClientClick(item.originalData as Client)
    } else {
      onTaskClick(item.originalData as Task)
    }
  }

  // Handle drop on column
  const handleDrop = async (e: React.DragEvent, targetDisposition: Disposition) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData("itemId")
    const itemType = e.dataTransfer.getData("itemType") as "client" | "task"
    const currentDisposition = e.dataTransfer.getData("currentDisposition")

    if (currentDisposition === targetDisposition) return

    if (itemType === "client" && onUpdateClientDisposition) {
      onUpdateClientDisposition(itemId, targetDisposition)
    } else if (itemType === "task" && onUpdateTaskDisposition) {
      onUpdateTaskDisposition(itemId, targetDisposition)
    }
  }

  // Calculate total for empty state
  const totalOpportunities = allItems.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Opportunities Pipeline</h3>
          <p className="text-sm text-gray-500 mt-1">
            Drag items between columns to update their status
          </p>
        </div>
        {/* Add Opportunity Button */}
        {onAddOpportunity && (
          <button
            onClick={onAddOpportunity}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Opportunity
          </button>
        )}
      </div>

      {/* Platform Goals Section */}
      <PlatformGoalsSummary 
        clients={clients}
        tasks={tasks}
        isExpanded={showGoals}
        onToggle={() => setShowGoals(!showGoals)}
      />

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4">
        {DISPOSITION_OPTIONS.map(({ value, label, color }) => (
          <KanbanColumn
            key={value}
            disposition={value}
            label={label}
            color={color}
            items={getItemsByDisposition(value)}
            totalValue={getColumnValue(value)}
            onItemClick={handleItemClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, value)}
          />
        ))}
      </div>

      {/* Empty State */}
      {totalOpportunities === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No opportunities yet</h4>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Mark clients or tasks as "Opportunity" to track them in this pipeline view
          </p>
        </div>
      )}
    </div>
  )
}

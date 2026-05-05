"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  GripVertical, 
  Target, 
  ChevronDown, 
  ChevronUp,
  TrendingUp,
  Plus,
  Layers
} from "lucide-react"
import { 
  formatCurrency, 
  formatDate, 
  BRAND_GOALS, 
  DISPOSITION_OPTIONS,
  DOC_OPTIONS,
  normalizeAssigneeName,
  isValidAssigneeName,
  TEAM_MEMBERS
} from "./types"
import { ArchivedOpportunitiesSection } from "./ArchivedOpportunitiesSection"
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
  name: string  // This will be the title for display
  companyName?: string  // Company name to show below title
  brand?: Brand
  value?: number
  disposition?: Disposition
  doc?: DOC
  dueDate?: string
  assignedTo?: string
  status?: string
  opportunityId?: string  // For tasks linked to opportunities
  clientId?: string       // For tasks linked to clients
  originalData: Client | Task
}

// Type for grouped/stacked kanban items (opportunity + linked tasks)
interface StackedKanbanItem {
  mainItem: KanbanItem  // The opportunity (client)
  linkedItems: KanbanItem[]  // Tasks linked to this opportunity
}

interface OpportunitiesKanbanViewProps {
  clients: Client[]
  tasks: Task[]
  assigneeFilter?: string
  onAssigneeFilterChange?: (assignee: string) => void
  onRefresh?: () => void
  onClientClick: (client: Client) => void
  onTaskClick: (task: Task) => void
  onOpportunityClick?: (client: Client) => void  // New: open opportunity modal instead of client modal
  onStackedItemsClick?: (opportunity: Client, linkedTasks: Task[]) => void  // Open opportunity and linked tasks
  onUpdateClientDisposition?: (clientId: string, disposition: Disposition) => void
  onUpdateTaskDisposition?: (taskId: string, disposition: Disposition) => void
  onAddOpportunity?: () => void
  onArchiveOpportunity?: (clientId: string) => void  // Archive an opportunity
  onRestoreOpportunity?: (clientId: string) => void  // Restore an archived opportunity
  currentUserName?: string  // Current logged-in user's name for default filters
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
    <div className="bg-white rounded-lg ring-1 ring-neutral-200/70 overflow-hidden mb-6">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-neutral-900">Platform Goals & Progress</h3>
            <p className="text-xs text-neutral-500">Annual targets by brand</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-5">
            {BRAND_GOALS.map((goal) => {
              const brandClients = clients.filter(c => matchesBrandGoal(c.brand, goal) && c.is_opportunity)
              const wonRevenue = brandClients
                .filter(c => c.disposition === "closed_won")
                .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
              const progress = Math.min(100, (wonRevenue / goal.annualGoal) * 100)

              return (
                <div key={goal.brand} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: goal.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium tabular-nums text-neutral-600">{Math.round(progress)}%</span>
                </div>
              )
            })}
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

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-100"
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
                    className="p-4 rounded-md ring-1 ring-neutral-200/70 bg-white"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                        <Target className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 truncate">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: goal.color }}
                            aria-hidden="true"
                          />
                          {displayName}
                        </p>
                        <p className="text-xs text-neutral-500 tabular-nums">{totalItems} opportunities</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-500">Goal</span>
                        <span className="font-medium tabular-nums text-neutral-900">{formatCurrency(goal.annualGoal, true)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-500">Won</span>
                        <span className="font-medium tabular-nums text-neutral-900">{formatCurrency(wonRevenue, true)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-500">Pipeline</span>
                        <span className="font-medium tabular-nums text-neutral-900">{formatCurrency(pipelineValue, true)}</span>
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-neutral-500">Progress <span className="text-neutral-400">(Won / Goal)</span></span>
                          <span className="font-medium tabular-nums text-neutral-900">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-neutral-900 transition-all duration-500"
                            style={{ width: `${progress}%` }}
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
  onDragStart,
  isStacked = false,
  stackIndex = 0,
  isHovered = false,
  isLinkedClient = false
}: { 
  item: KanbanItem
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  isStacked?: boolean
  stackIndex?: number
  isHovered?: boolean
  isLinkedClient?: boolean
}) {
  const docLabel = item.doc ? `${item.doc}%` : null

  // Calculate offset for stacked cards
  const stackOffset = isStacked ? stackIndex * 8 : 0
  const stackRotation = isStacked ? stackIndex * 2 : 0
  const hoverOffset = isHovered ? stackIndex * 85 : 0 // Fan out when hovered

  return (
    <motion.div
      draggable={!isStacked || stackIndex === 0}
      onDragStartCapture={onDragStart}
      onClick={onClick}
      initial={false}
      animate={{
        x: hoverOffset,
        y: isStacked && !isHovered ? stackOffset : 0,
        rotate: isStacked && !isHovered ? stackRotation : 0,
        scale: isStacked && !isHovered ? 1 - (stackIndex * 0.02) : 1,
      }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25 
      }}
      className={`group p-3 rounded-md bg-white ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,outline-color] cursor-grab active:cursor-grabbing ${
        isStacked && stackIndex > 0 ? "absolute inset-0" : "relative"
      } ${isStacked && stackIndex > 0 && !isHovered ? "pointer-events-none" : ""} ${
        isLinkedClient ? "ring-2 ring-neutral-900/30" : ""
      }`}
      style={{
        zIndex: isStacked ? 10 - stackIndex : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {/* Linked-client pill */}
          {isLinkedClient && isStacked && stackIndex > 0 && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                <span className="inline-block h-1 w-1 rounded-full bg-blue-500" aria-hidden="true" />
                Linked Client
              </span>
            </div>
          )}

          {/* Linked-task pill */}
          {!isLinkedClient && isStacked && stackIndex > 0 && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                <span className="inline-block h-1 w-1 rounded-full bg-teal-500" aria-hidden="true" />
                Linked Task
              </span>
            </div>
          )}

          {/* DOC pill */}
          {docLabel && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700 tabular-nums">
                <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                DOC · {docLabel}
              </span>
            </div>
          )}

          {/* Title (opportunity title) */}
          <p className="text-sm font-medium text-gray-900 truncate leading-snug">
            {item.name}
          </p>

          {/* Company Name */}
          {item.companyName && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {item.companyName}
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-2">
            {item.value && item.value > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-neutral-900">
                {formatCurrency(item.value, true)}
              </span>
            )}
            {item.value && item.value > 0 && item.brand && (
              <span className="text-neutral-300" aria-hidden="true">·</span>
            )}
            {item.brand && (
              <span className="text-xs text-neutral-500 truncate">
                {item.brand}
              </span>
            )}
          </div>

          {/* Due date or follow-up */}
          {item.dueDate && (
            <p className="text-xs text-gray-400 mt-1.5">
              Follow up: {formatDate(item.dueDate)}
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
    </motion.div>
  )
}

// Stacked Kanban Card - shows opportunity with linked tasks and clients behind it
function StackedKanbanCard({
  stackedItem,
  onMainClick,
  onStackedClick,
  onDragStart
}: {
  stackedItem: StackedKanbanItem
  onMainClick: (item: KanbanItem) => void
  onStackedClick: (mainItem: KanbanItem, linkedItems: KanbanItem[]) => void
  onDragStart: (e: React.DragEvent, item: KanbanItem, linkedItems: KanbanItem[]) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const hasLinkedItems = stackedItem.linkedItems.length > 0
  
  // Calculate total linked count (tasks only)
  const totalLinkedCount = stackedItem.linkedItems.length

  const handleClick = () => {
    if (hasLinkedItems) {
      onStackedClick(stackedItem.mainItem, stackedItem.linkedItems)
    } else {
      onMainClick(stackedItem.mainItem)
    }
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        // Add extra space when hovered to accommodate fanned out cards
        marginBottom: isHovered && hasLinkedItems ? 0 : 0,
        paddingRight: isHovered && hasLinkedItems ? (totalLinkedCount) * 10 : 0,
        transition: "padding-right 0.3s ease"
      }}
    >
      {/* Stack indicator badge for linked items */}
      {hasLinkedItems && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2 -right-2 z-20 flex items-center gap-1 px-2 py-1 text-white text-[10px] font-medium rounded-full shadow-lg bg-sky-600"
        >
          <Layers className="w-3 h-3" />
          {totalLinkedCount + 0}
        </motion.div>
      )}

      {/* Render linked task items (they go behind main card) */}
      <AnimatePresence>
        {stackedItem.linkedItems.map((linkedItem, index) => (
          <KanbanCard
            key={`${linkedItem.type}-${linkedItem.id}`}
            item={linkedItem}
            onClick={() => onMainClick(linkedItem)}
            onDragStart={(e) => e.preventDefault()}
            isStacked={true}
            stackIndex={index + 1}
            isHovered={isHovered}
          />
        ))}
      </AnimatePresence>

      {/* Main opportunity card (on top) */}
      <KanbanCard
        item={stackedItem.mainItem}
        onClick={handleClick}
        onDragStart={(e) => onDragStart(e, stackedItem.mainItem, stackedItem.linkedItems)}
        isStacked={hasLinkedItems}
        stackIndex={0}
        isHovered={isHovered}
      />

      {/* Hover hint */}
      {hasLinkedItems && !isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-1 right-1 text-[10px] text-gray-400 pointer-events-none"
        >
          Hover to view linked
        </motion.div>
      )}
    </div>
  )
}

// Kanban Column
function KanbanColumn({ 
  disposition, 
  label, 
  color, 
  stackedItems,
  totalValue,
  onItemClick,
  onStackedClick,
  onDragOver,
  onDrop 
}: { 
  disposition: Disposition
  label: string
  color: string
  stackedItems: StackedKanbanItem[]
  totalValue: number
  onItemClick: (item: KanbanItem) => void
  onStackedClick: (mainItem: KanbanItem, linkedItems: KanbanItem[]) => void
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

  // Count total items including linked tasks
  const totalItemsCount = stackedItems.reduce(
    (sum, si) => sum + 1 + si.linkedItems.length, 
    0
  )

  return (
    <div
      className={`flex flex-col min-w-[300px] flex-1 rounded-md transition-all ${
        isDragOver ? "ring-2 ring-neutral-900 ring-offset-2" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header — flat single-line strip, dot + label · count · total */}
      <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <h4 className="text-sm font-medium text-neutral-900 truncate">{label}</h4>
          <span className="text-xs tabular-nums text-neutral-500 shrink-0">
            ({stackedItems.length}
            {totalItemsCount > stackedItems.length && (
              <span className="text-neutral-400 ml-0.5">+{totalItemsCount - stackedItems.length}</span>
            )}
            )
          </span>
        </div>
        {totalValue > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-neutral-600 shrink-0">
            <span className="text-neutral-300" aria-hidden="true">·</span>
            {formatCurrency(totalValue, true)}
          </span>
        )}
      </div>

      {/* Cards Container — drop indicator surfaces on dragOver instead of a static gray-50 card */}
      <div
        className={`flex-1 p-2 space-y-3 rounded-md min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto overflow-x-visible transition-colors ${
          isDragOver ? "bg-neutral-100" : "bg-neutral-50/40"
        }`}
      >
        {stackedItems.length === 0 ? (
          <div
            className={`flex items-center justify-center h-24 border border-dashed rounded-md transition-colors ${
              isDragOver ? "border-neutral-400 bg-white" : "border-neutral-200"
            }`}
          >
            <p className="text-xs text-neutral-400">{isDragOver ? "Release to drop" : "Drop items here"}</p>
          </div>
        ) : (
          stackedItems.map((stackedItem) => (
            <StackedKanbanCard
              key={`stacked-${stackedItem.mainItem.type}-${stackedItem.mainItem.id}`}
              stackedItem={stackedItem}
              onMainClick={onItemClick}
              onStackedClick={onStackedClick}
              onDragStart={(e, mainItem, linkedItems) => {
                // Store all IDs for linked items so they move together
                const linkedIds = linkedItems.map(li => li.id)
                e.dataTransfer.setData("itemId", mainItem.id)
                e.dataTransfer.setData("itemType", mainItem.type)
                e.dataTransfer.setData("currentDisposition", mainItem.disposition || "pitched")
                e.dataTransfer.setData("linkedItemIds", JSON.stringify(linkedIds))
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
  assigneeFilter = "all",
  onAssigneeFilterChange,
  onRefresh,
  onClientClick,
  onTaskClick,
  onOpportunityClick,
  onStackedItemsClick,
  onUpdateClientDisposition,
  onUpdateTaskDisposition,
  onAddOpportunity,
  onArchiveOpportunity,
  onRestoreOpportunity,
  currentUserName
}: OpportunitiesKanbanViewProps) {
  const [showGoals, setShowGoals] = useState(false)
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: "client" | "task" } | null>(null)

  // Filter only opportunity items - separate active from archived
  const allOpportunityClients = clients.filter(c => c.is_opportunity)
  const opportunityClients = allOpportunityClients.filter(c => !c.is_archived)
  const archivedOpportunities = allOpportunityClients.filter(c => c.is_archived)
  const opportunityTasks = tasks.filter(t => t.is_opportunity)
  
  // Get unique assignees from opportunities for the filter dropdown
  // Normalize names and filter out short names like TasksView does
  const uniqueAssignees = Array.from(
    new Set(
      [...opportunityClients, ...opportunityTasks]
        .map(item => item.assigned_to)
        .filter((assignee): assignee is string => 
          typeof assignee === "string" && assignee.trim() !== ""
        )
        .map(normalizeAssigneeName)
        .filter(name => isValidAssigneeName(name) && name !== "Unassigned")
    )
  ).sort()

  // Also include team members who may not have any opportunities yet
  const allAssignees = Array.from(
    new Set([...uniqueAssignees, ...TEAM_MEMBERS.map(m => m.name)])
  ).sort()

  // Filter opportunities by assignee (compare normalized names)
  const filteredOpportunityClients = assigneeFilter === "all" 
    ? opportunityClients 
    : opportunityClients.filter(c => normalizeAssigneeName(c.assigned_to || "") === assigneeFilter)
  const filteredOpportunityTasks = assigneeFilter === "all"
    ? opportunityTasks
    : opportunityTasks.filter(t => normalizeAssigneeName(t.assigned_to || "") === assigneeFilter)

  // Convert to kanban items
  const convertToKanbanItems = useCallback((): KanbanItem[] => {
    const clientItems: KanbanItem[] = filteredOpportunityClients.map(client => ({
      id: client.id,
      type: "client" as const,
      name: client.title || client.company_name || client.name,  // Show title first, then company name
      companyName: client.title ? (client.company_name || client.name) : undefined,  // Show company below if title exists
      brand: client.brand,
      value: client.pitch_value,
      disposition: client.disposition || "pitched",
      doc: client.doc,
      dueDate: client.next_followup_date,
      assignedTo: client.assigned_to,
      status: client.status,
      originalData: client
    }))

    const taskItems: KanbanItem[] = filteredOpportunityTasks.map(task => ({
      id: task.id,
      type: "task" as const,
      name: task.title,
      companyName: task.client_name,
      brand: task.brand,
      value: undefined,
      disposition: task.disposition || "pitched",
      doc: task.doc,
      dueDate: task.due_date,
      assignedTo: task.assigned_to,
      status: task.status,
      opportunityId: task.opportunity_id,  // Track which opportunity this task is linked to
      clientId: task.client_id,            // Track which client this task is linked to
      originalData: task
    }))

    return [...clientItems, ...taskItems]
  }, [filteredOpportunityClients, filteredOpportunityTasks])

  const allItems = convertToKanbanItems()

  // Group items into stacked items - opportunities with their linked tasks
  const getStackedItemsByDisposition = useCallback((disposition: Disposition): StackedKanbanItem[] => {
    const itemsInDisposition = allItems.filter(item => (item.disposition || "pitched") === disposition)
    
    // Find all opportunity clients (these are the main cards)
    const opportunityItems = itemsInDisposition.filter(item => item.type === "client")
    
    // Find all tasks that are linked to opportunities
    const linkedTaskItems = allItems.filter(item => 
      item.type === "task" && item.opportunityId
    )
    
    // Find standalone tasks (not linked to any opportunity)
    const standaloneTaskItems = itemsInDisposition.filter(item => 
      item.type === "task" && !item.opportunityId
    )
    
    // Build stacked items
    const stacked: StackedKanbanItem[] = []
    
    // Process opportunities with their linked tasks
    opportunityItems.forEach(oppItem => {
      const linkedTasks = linkedTaskItems.filter(task => task.opportunityId === oppItem.id)
      
      stacked.push({
        mainItem: oppItem,
        linkedItems: linkedTasks
      })
    })
    
    // Add standalone tasks as their own stacked items
    standaloneTaskItems.forEach(taskItem => {
      stacked.push({
        mainItem: taskItem,
        linkedItems: []
      })
    })
    
    return stacked
  }, [allItems, clients])

  // Calculate total value for a column (including linked items)
  const getColumnValue = (disposition: Disposition): number => {
    const stackedItems = getStackedItemsByDisposition(disposition)
    return stackedItems.reduce((sum, si) => {
      const mainValue = si.mainItem.value || 0
      const linkedValue = si.linkedItems.reduce((s, li) => s + (li.value || 0), 0)
      return sum + mainValue + linkedValue
    }, 0)
  }

  // Handle item click - use opportunity modal for clients, task modal for tasks
  const handleItemClick = (item: KanbanItem) => {
    if (item.type === "client") {
      // Use opportunity modal if available, otherwise fall back to client modal
      if (onOpportunityClick) {
        onOpportunityClick(item.originalData as Client)
      } else {
        onClientClick(item.originalData as Client)
      }
    } else {
      onTaskClick(item.originalData as Task)
    }
  }

  // Handle stacked items click - open opportunity and linked tasks
  const handleStackedClick = (mainItem: KanbanItem, linkedItems: KanbanItem[]) => {
    if (onStackedItemsClick && mainItem.type === "client") {
      const linkedTasks = linkedItems
        .filter(li => li.type === "task")
        .map(li => li.originalData as Task)
      onStackedItemsClick(mainItem.originalData as Client, linkedTasks)
    } else {
      // Fallback to regular click
      handleItemClick(mainItem)
    }
  }

  // Handle drop on column - move opportunity AND linked tasks together
  const handleDrop = async (e: React.DragEvent, targetDisposition: Disposition) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData("itemId")
    const itemType = e.dataTransfer.getData("itemType") as "client" | "task"
    const currentDisposition = e.dataTransfer.getData("currentDisposition")
    const linkedItemIdsJson = e.dataTransfer.getData("linkedItemIds")

    if (currentDisposition === targetDisposition) return

    // Update the main item
    if (itemType === "client" && onUpdateClientDisposition) {
      onUpdateClientDisposition(itemId, targetDisposition)
      
      // Also update all linked tasks to follow the opportunity
      if (linkedItemIdsJson && onUpdateTaskDisposition) {
        try {
          const linkedIds: string[] = JSON.parse(linkedItemIdsJson)
          linkedIds.forEach(linkedId => {
            onUpdateTaskDisposition(linkedId, targetDisposition)
          })
        } catch (err) {
          console.error("Error parsing linked item IDs:", err)
        }
      }
    } else if (itemType === "task" && onUpdateTaskDisposition) {
      onUpdateTaskDisposition(itemId, targetDisposition)
    }
  }

  // Calculate total for empty state
  const totalOpportunities = allItems.length
  const totalUnfilteredOpportunities = opportunityClients.length + opportunityTasks.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium text-neutral-900">Opportunities Pipeline</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Drag items between columns to update their status
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Assignee Filter */}
          {onAssigneeFilterChange && (
            <select
              value={assigneeFilter}
              onChange={(e) => onAssigneeFilterChange(e.target.value)}
              className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400"
              aria-label="Filter opportunities by assignee"
            >
              <option value="all">All assignees</option>
              {allAssignees.map((assignee) => (
                <option key={assignee} value={assignee}>{assignee}</option>
              ))}
            </select>
          )}
          {/* Add Opportunity Button */}
          {onAddOpportunity && (
            <button
              onClick={onAddOpportunity}
              className="inline-flex items-center gap-2 h-9 px-3.5 text-sm bg-neutral-900 text-white hover:bg-neutral-800 rounded-md transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add opportunity
            </button>
          )}
        </div>
      </div>

      {/* Platform Goals Section */}
      <PlatformGoalsSummary 
        key={`goals-${clients.filter(c => c.disposition === "closed_won").length}-${clients.reduce((sum, c) => sum + (c.pitch_value || 0), 0)}`}
        clients={clients}
        tasks={tasks}
        isExpanded={showGoals}
        onToggle={() => setShowGoals(!showGoals)}
      />

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 overflow-x-visible">
        {DISPOSITION_OPTIONS.map(({ value, label, color }) => (
          <KanbanColumn
            key={value}
            disposition={value}
            label={label}
            color={color}
            stackedItems={getStackedItemsByDisposition(value)}
            totalValue={getColumnValue(value)}
            onItemClick={handleItemClick}
            onStackedClick={handleStackedClick}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, value)}
          />
        ))}
      </div>

      {/* Empty State — single CTA, action-led */}
      {totalOpportunities === 0 && (
        <div className="text-center py-14 bg-white rounded-md ring-1 ring-neutral-200/70">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-4">
            <Target className="w-5 h-5" />
          </div>
          <h4 className="text-base font-medium text-neutral-900 mb-1">No opportunities yet</h4>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-5">
            Mark a client or task as an opportunity to start tracking it here.
          </p>
          {onAddOpportunity && (
            <button
              onClick={onAddOpportunity}
              className="inline-flex items-center gap-2 h-9 px-3.5 text-sm bg-neutral-900 text-white hover:bg-neutral-800 rounded-md transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add opportunity
            </button>
          )}
        </div>
      )}

      {/* Archived Opportunities Section */}
      {onRestoreOpportunity && (
        <ArchivedOpportunitiesSection
          archivedOpportunities={archivedOpportunities}
          onRestoreOpportunity={onRestoreOpportunity}
          onOpportunityClick={onOpportunityClick}
          currentUserName={currentUserName}
        />
      )}
    </div>
  )
}

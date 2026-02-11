"use client"

import { Target, Users, CheckCircle2 } from "lucide-react"
import type { Client, Task } from "./types"

interface LinkedTasksPanelProps {
  linkedTasks: Task[]
  linkedClientForPanel: Client | null
  currentOpportunityForLinked: Client | null
  onClose: () => void
  onEditClient: (client: Client) => void
  onOpenTask: (task: Task) => void
}

export default function LinkedTasksPanel({
  linkedTasks,
  linkedClientForPanel,
  currentOpportunityForLinked,
  onClose,
  onEditClient,
  onOpenTask,
}: LinkedTasksPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl pointer-events-auto overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-linear-to-r from-sky-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-sky-100 to-cyan-100 rounded-lg">
              <Target className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Linked Items</h3>
              {currentOpportunityForLinked && (
                <p className="text-sm text-gray-500 truncate max-w-62.5">
                  {currentOpportunityForLinked.title || currentOpportunityForLinked.company_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Linked Client Section */}
          {linkedClientForPanel && (
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                <Users className="w-3 h-3" />
                Linked Client
              </p>
              <button
                onClick={() => {
                  onClose()
                  onEditClient(linkedClientForPanel)
                }}
                className="w-full text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                      {linkedClientForPanel.company_name || linkedClientForPanel.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {linkedClientForPanel.brand && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
                          {linkedClientForPanel.brand}
                        </span>
                      )}
                      {linkedClientForPanel.status && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                          {linkedClientForPanel.status}
                        </span>
                      )}
                    </div>
                    {linkedClientForPanel.assigned_to && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Assigned to: {linkedClientForPanel.assigned_to}
                      </p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-blue-300 group-hover:text-blue-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          )}

          {/* Linked Tasks Section */}
          {linkedTasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3" />
                Linked Tasks ({linkedTasks.length})
              </p>
              <div className="space-y-3">
                {linkedTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onOpenTask(task)}
                    className={`w-full text-left p-4 rounded-xl border transition-all group ${
                      task.status === "completed"
                        ? "border-gray-200 bg-gray-50 opacity-60 hover:opacity-100 hover:bg-gray-100"
                        : "border-gray-200 bg-white hover:bg-gray-50 hover:border-teal-200 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          task.status === "completed"
                            ? "bg-gray-200"
                            : task.status === "in_progress"
                              ? "bg-blue-100"
                              : "bg-amber-100"
                        }`}
                      >
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            task.status === "completed"
                              ? "text-gray-500"
                              : task.status === "in_progress"
                                ? "text-blue-600"
                                : "text-amber-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-teal-700 transition-colors">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {task.brand && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                              {task.brand}
                            </span>
                          )}
                          {task.priority && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${
                                task.priority === "high" || task.priority === "urgent"
                                  ? "bg-red-100 text-red-700"
                                  : task.priority === "medium"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {task.priority}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-[10px] text-gray-500">
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {task.assigned_to && (
                          <p className="text-xs text-gray-400 mt-1.5">
                            Assigned to: {task.assigned_to}
                          </p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-teal-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Linked items move together when you drag the opportunity on the kanban
          </p>
        </div>
      </div>
    </div>
  )
}

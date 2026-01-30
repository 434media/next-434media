// CRM Components - Export all
export * from "./types"
export { Toast } from "./Toast"
export { StatCard } from "./StatCard"
export { QuickActionCard } from "./QuickActionCard"
export { DashboardView } from "./DashboardView"
export { PipelineView } from "./PipelineView"
export { OpportunitiesKanbanView } from "./OpportunitiesKanbanView"
export { ArchivedOpportunitiesSection } from "./ArchivedOpportunitiesSection"
export { ClientsView } from "./ClientsView"
export { TasksView } from "./TasksView"
export { SocialCalendarView } from "./SocialCalendarView"
export { ClientFormModal } from "./ClientFormModal"
export { OpportunityFormModal } from "./OpportunityFormModal"
export { TaskModal } from "./TaskModal"
export { NotificationBell } from "./NotificationBell"

// Re-export notification context types for convenience
export type { Notification } from "../../context/notification-context"

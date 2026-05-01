"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Bell,
  CheckCircle2,
  Clock,
  AtSign,
  UserPlus,
  Trash2,
  History,
  ExternalLink,
} from "lucide-react"
import { useNotifications, type Notification } from "../../context/notification-context"

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "mention":
      return <AtSign className="w-3.5 h-3.5 text-blue-500" />
    case "assignment":
      return <UserPlus className="w-3.5 h-3.5 text-green-500" />
    case "tagged":
      return <AtSign className="w-3.5 h-3.5 text-purple-500" />
    default:
      return <Bell className="w-3.5 h-3.5 text-neutral-400" />
  }
}

function getNotificationMessage(n: Notification) {
  switch (n.type) {
    case "mention":
      return (
        <span>
          <strong className="text-neutral-700">{n.comment_author}</strong> mentioned you
        </span>
      )
    case "assignment":
      return (
        <span>
          <strong className="text-neutral-700">{n.assigned_by}</strong> assigned you
        </span>
      )
    case "tagged":
      return (
        <span>
          <strong className="text-neutral-700">{n.assigned_by}</strong> tagged you
        </span>
      )
    case "system":
      return <span>{n.message}</span>
    default:
      return <span>New notification</span>
  }
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"new" | "history">("new")
  const ref = useRef<HTMLDivElement>(null)

  const {
    notifications,
    notificationHistory,
    unreadCount,
    isLoading,
    hasNewNotification,
    markAsRead,
    markAllAsRead,
    clearHistory,
  } = useNotifications()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const items = tab === "new" ? notifications : notificationHistory

  const handleClick = (n: Notification) => {
    if (n.task_id) {
      sessionStorage.setItem("openTaskId", n.task_id)
      window.location.href = "/admin/crm"
    }
    markAsRead([n.id])
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="relative p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold text-white bg-red-500 rounded-full leading-none"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {hasNewNotification && unreadCount === 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden z-50"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header with tab + actions */}
            <div className="flex items-center border-b border-neutral-200">
              <button
                onClick={() => setTab("new")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                  tab === "new"
                    ? "text-neutral-900 border-b-2 border-neutral-900 -mb-px"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Inbox
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold text-white bg-red-500 rounded-full leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                  tab === "history"
                    ? "text-neutral-900 border-b-2 border-neutral-900 -mb-px"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                History
              </button>
            </div>

            {/* Action row — only present when there's something to act on */}
            {items.length > 0 && (
              <div className="flex items-center justify-end px-3 py-1.5 bg-neutral-50 border-b border-neutral-100">
                {tab === "new" ? (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Mark all read
                  </button>
                ) : (
                  <button
                    onClick={clearHistory}
                    className="text-[11px] text-neutral-500 hover:text-red-600 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading && items.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  {tab === "new" ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-neutral-700 font-medium">All caught up</p>
                      <p className="text-xs text-neutral-400 mt-0.5">No new notifications</p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-8 h-8 text-neutral-300 mb-2" />
                      <p className="text-sm text-neutral-700 font-medium">No history</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Read notifications appear here</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => (tab === "new" ? handleClick(n) : null)}
                      className={`w-full px-4 py-3 text-left flex gap-2.5 transition-colors ${
                        tab === "new"
                          ? "hover:bg-neutral-50 cursor-pointer"
                          : "cursor-default opacity-70"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        {n.task_title && (
                          <p className="text-[13px] text-neutral-900 line-clamp-1 font-medium">
                            {n.task_title}
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {getNotificationMessage(n)}
                        </p>
                        {n.comment_preview && (
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1 italic">
                            &ldquo;{n.comment_preview}&rdquo;
                          </p>
                        )}
                        <p className="text-[10px] text-neutral-400 mt-1">
                          {formatTimeAgo(n.created_at)}
                        </p>
                      </div>
                      {tab === "new" && (
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0 mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
